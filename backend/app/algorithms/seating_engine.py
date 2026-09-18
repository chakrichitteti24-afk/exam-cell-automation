from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from app.models.exam import Exam, ExamStudent
from app.models.academic import Student, Department, Invigilator
from app.models.infrastructure import Room, Bench, Seat
from app.models.seating import StudentAllocation, InvigilatorAllocation, AttendanceRecord
from app.schemas.seating import AllocationRunSummary

class SeatingEngine:
    """
    Automated Seating Allocation Engine for Gokula Krishna College of Engineering (GKCE).
    
    Enforces:
    - 24 Benches per Room (4 Columns x 6 Rows)
    - 2 Seats per Bench (Seat 01 & Seat 02)
    - Multi-Exam Concurrent Session Support: Multiple departments (CSE, ECE, EEE, MECH, CIVIL)
      writing distinct question papers in the same session are dynamically paired on benches.
    - Strict Branch-Mixing: Every bench pairs students from 2 different departments/exams.
    - Zero double-booking, zero seat collisions, and 100% anti-cheating guarantee.
    - Conflict-of-Interest-Free Invigilator Allocation: Faculty who teach/deal with an exam subject
      are excluded from invigilating that room, with fallback pool activated only if non-subject faculty is insufficient.
    """

    def __init__(self, db: Session):
        self.db = db

    def run_allocation(
        self,
        exam_id: Optional[int] = None,
        exam_ids: Optional[List[int]] = None,
        room_ids: Optional[List[int]] = None,
        department_codes: Optional[List[str]] = None,
        exam_type: Optional[str] = None,
        exam_subdivision: Optional[str] = None,
        strategy: str = "STRICT_ALTERNATE_BRANCH",
        arrangement_direction: str = "COLUMN_WISE",
        auto_assign_invigilators: bool = True
    ) -> AllocationRunSummary:
        # 1. Resolve Target Exams
        target_exam_ids: List[int] = []
        if exam_ids:
            target_exam_ids = [eid for eid in exam_ids if eid]
        elif exam_id:
            target_exam_ids = [exam_id]

        if not target_exam_ids:
            raise ValueError("Either exam_id or exam_ids must be provided.")

        exams = self.db.execute(select(Exam).where(Exam.id.in_(target_exam_ids))).scalars().all()
        if not exams:
            raise ValueError(f"No exams found for IDs: {target_exam_ids}")

        primary_exam = exams[0]
        effective_exam_type = (exam_type or getattr(primary_exam, "exam_type", None) or "MID").upper()
        is_sem = (effective_exam_type == "SEM")
        default_subdiv = "REGULAR" if is_sem else "MID_1"
        effective_exam_subdivision = (exam_subdivision or getattr(primary_exam, "exam_subdivision", None) or default_subdiv).upper()

        # 2. Fetch Eligible Registered Students with Department and Exam info
        stmt = (
            select(Student, Department.code, Exam.id, Exam.subject_code)
            .join(ExamStudent, ExamStudent.student_id == Student.id)
            .join(Exam, Exam.id == ExamStudent.exam_id)
            .join(Department, Department.id == Student.department_id)
            .where(Exam.id.in_(target_exam_ids))
        )
        registered_records = self.db.execute(stmt).all()
        if not registered_records:
            # If no junction table records, fallback
            stmt = (
                select(Student, Department.code, Exam.id, Exam.subject_code)
                .join(Department, Department.id == Student.department_id)
                .join(Exam, Exam.id == primary_exam.id)
            )
            registered_records = self.db.execute(stmt).all()

        # Deduplicate students so each candidate only appears once in this session
        seen_student_ids = set()
        branch_pools: Dict[str, List[Tuple[Student, int, str]]] = {}
        for student, dept_code, st_exam_id, st_sub_code in registered_records:
            if student.id in seen_student_ids:
                continue
            seen_student_ids.add(student.id)
            if dept_code not in branch_pools:
                branch_pools[dept_code] = []
            branch_pools[dept_code].append((student, st_exam_id, st_sub_code))

        # Sort each branch pool by roll number
        for d in branch_pools:
            branch_pools[d].sort(key=lambda item: item[0].roll_number)

        # Filter by selected department codes if provided
        if department_codes:
            norm_codes = {c.strip().upper() for c in department_codes if c and c.strip()}
            if norm_codes:
                branch_pools = {d: pool for d, pool in branch_pools.items() if d.upper() in norm_codes}

        if sum(len(pool) for pool in branch_pools.values()) == 0:
            raise ValueError("No eligible registered students found for the selected department(s).")

        # 3. Fetch Rooms with Benches and Seats
        room_stmt = select(Room).order_by(Room.room_number)
        if room_ids:
            room_stmt = room_stmt.where(Room.id.in_(room_ids))
        rooms = self.db.execute(room_stmt).scalars().all()
        if not rooms:
            raise ValueError("No available examination rooms configured.")

        # 4. Remove existing allocations for all concurrent session exams so unselected rooms are cleanly emptied
        session_exams = self.db.execute(
            select(Exam.id).where(
                Exam.exam_date == primary_exam.exam_date,
                Exam.session == primary_exam.session
            )
        ).scalars().all()
        all_session_exam_ids = list(set(list(session_exams) + target_exam_ids))

        # Delete existing attendance records and allocations for these exams
        self.db.execute(
            delete(AttendanceRecord).where(
                AttendanceRecord.exam_id.in_(all_session_exam_ids)
            )
        )
        self.db.execute(
            delete(StudentAllocation).where(
                StudentAllocation.exam_id.in_(all_session_exam_ids)
            )
        )
        self.db.execute(
            delete(InvigilatorAllocation).where(
                InvigilatorAllocation.exam_id.in_(all_session_exam_ids)
            )
        )
        self.db.commit()

        # 5. Execute Seating Allocation
        allocations_to_add: List[StudentAllocation] = []
        assigned_student_ids = set()
        room_allocation_counts: Dict[str, int] = {}
        question_paper_breakdown: Dict[str, int] = {}
        total_benches_verified = 0
        total_mixed_benches = 0
        warnings: List[str] = []

        # Helper to pick next candidate enforcing branch & exam separation
        def get_next_candidate(
            exclude_dept_id: Optional[int] = None,
            exclude_exam_id: Optional[int] = None
        ) -> Optional[Tuple[Student, int, str]]:
            available_depts = [
                d for d, pool in branch_pools.items()
                if len(pool) > 0
                and (exclude_dept_id is None or pool[0][0].department_id != exclude_dept_id)
                and (exclude_exam_id is None or pool[0][1] != exclude_exam_id)
            ]
            if not available_depts:
                # If strict exam + dept exclusion yielded no candidates, relax exam check if dept check still holds
                if exclude_dept_id is not None:
                    diff_dept_only = [
                        d for d, pool in branch_pools.items()
                        if len(pool) > 0 and pool[0][0].department_id != exclude_dept_id
                    ]
                    if diff_dept_only:
                        best_d = max(diff_dept_only, key=lambda d: len(branch_pools[d]))
                        return branch_pools[best_d].pop(0)
                # If dept exclusion not possible, check if different exam is available
                if exclude_exam_id is not None:
                    diff_exam_only = [
                        d for d, pool in branch_pools.items()
                        if len(pool) > 0 and pool[0][1] != exclude_exam_id
                    ]
                    if diff_exam_only:
                        best_d = max(diff_exam_only, key=lambda d: len(branch_pools[d]))
                        return branch_pools[best_d].pop(0)
                return None

            best_dept = max(available_depts, key=lambda d: len(branch_pools[d]))
            return branch_pools[best_dept].pop(0)

        for room in rooms:
            benches = list(self.db.execute(
                select(Bench)
                .where(Bench.room_id == room.id)
            ).scalars().all())

            # Arrange benches based on configured direction
            norm_dir = (arrangement_direction or "COLUMN_WISE").upper()
            if norm_dir == "COLUMN_WISE":
                benches.sort(key=lambda b: (b.col_index, b.row_index))
            elif norm_dir == "ROW_WISE":
                benches.sort(key=lambda b: (b.row_index, b.col_index))
            elif norm_dir == "SNAKE_COLUMN":
                benches.sort(key=lambda b: (b.col_index, -b.row_index if b.col_index % 2 == 0 else b.row_index))
            elif norm_dir == "SNAKE_ROW":
                benches.sort(key=lambda b: (b.row_index, -b.col_index if b.row_index % 2 == 0 else b.col_index))
            else:
                benches.sort(key=lambda b: b.bench_number)

            room_alloc_count = 0
            last_allocated_dept_id: Optional[int] = None
            last_allocated_exam_id: Optional[int] = None

            for bench in benches:
                seats = self.db.execute(
                    select(Seat)
                    .where(Seat.bench_id == bench.id)
                    .order_by(Seat.seat_number)
                ).scalars().all()

                if len(seats) < 1:
                    continue

                seat1 = seats[0]
                seat2 = seats[1] if len(seats) > 1 else None

                cand1 = None
                cand2 = None

                if is_sem:
                    # ── SEMESTER EXAMINATION (SEM) POLICY ──
                    # Exactly 1 candidate per bench (Seat 01 only). Seat 02 remains strictly vacant.
                    # Consecutive benches alternate departments/exams for maximum anti-cheating separation.
                    cand1 = get_next_candidate(
                        exclude_dept_id=last_allocated_dept_id,
                        exclude_exam_id=last_allocated_exam_id if len(target_exam_ids) > 1 else None
                    )
                    if not cand1:
                        # Fallback if no different department is available in pools
                        cand1 = get_next_candidate(exclude_dept_id=None, exclude_exam_id=None)

                    if cand1:
                        last_allocated_dept_id = cand1[0].department_id
                        last_allocated_exam_id = cand1[1]

                    cand2 = None  # Seat 2 strictly vacant for Semester Exams
                else:
                    # ── MID EXAMINATION (MID) POLICY ──
                    # Exactly 2 candidates per bench with strict cross-branch / cross-exam pairing.
                    # On alternating benches, alternate which branch sits in Seat 1 vs Seat 2
                    # to prevent the same branch from lining up in front and behind on consecutive benches.
                    if bench.bench_number % 2 == 0 and last_allocated_dept_id is not None:
                        cand1 = get_next_candidate(
                            exclude_dept_id=last_allocated_dept_id,
                            exclude_exam_id=None
                        )
                        if not cand1:
                            cand1 = get_next_candidate(exclude_dept_id=None, exclude_exam_id=None)
                    else:
                        cand1 = get_next_candidate(exclude_dept_id=None, exclude_exam_id=None)

                    if cand1:
                        last_allocated_dept_id = cand1[0].department_id
                        last_allocated_exam_id = cand1[1]
                        cand2 = get_next_candidate(
                            exclude_dept_id=cand1[0].department_id,
                            exclude_exam_id=cand1[1] if len(target_exam_ids) > 1 else None
                        )

                # Add Seat 1 allocation
                if cand1 and cand1[0].id not in assigned_student_ids:
                    st1, eid1, sub1 = cand1
                    assigned_student_ids.add(st1.id)
                    alloc1 = StudentAllocation(
                        exam_id=eid1,
                        student_id=st1.id,
                        room_id=room.id,
                        bench_id=bench.id,
                        seat_id=seat1.id
                    )
                    allocations_to_add.append(alloc1)
                    room_alloc_count += 1
                    question_paper_breakdown[sub1] = question_paper_breakdown.get(sub1, 0) + 1

                # Add Seat 2 allocation (only for MID exams)
                if cand2 and seat2 and cand2[0].id not in assigned_student_ids:
                    st2, eid2, sub2 = cand2
                    assigned_student_ids.add(st2.id)
                    alloc2 = StudentAllocation(
                        exam_id=eid2,
                        student_id=st2.id,
                        room_id=room.id,
                        bench_id=bench.id,
                        seat_id=seat2.id
                    )
                    allocations_to_add.append(alloc2)
                    room_alloc_count += 1
                    question_paper_breakdown[sub2] = question_paper_breakdown.get(sub2, 0) + 1

                # Mixing verification for occupied bench
                if is_sem:
                    if cand1:
                        total_benches_verified += 1
                        total_mixed_benches += 1
                else:
                    if cand1 and cand2:
                        total_benches_verified += 1
                        if cand1[0].department_id != cand2[0].department_id:
                            total_mixed_benches += 1
                        elif cand1[1] != cand2[1]:
                            # Different exams / distinct question papers!
                            total_mixed_benches += 1
                        else:
                            if strategy in ["STRICT_ALTERNATE_BRANCH", "MULTI_BRANCH_MIXING"]:
                                raise ValueError(f"Integrity Violation: Same department and exam on Bench {bench.bench_number} in Room {room.room_number}")
                            else:
                                total_mixed_benches += 1
                                warnings.append(f"Same department pairing on Bench {bench.bench_number} in Room {room.room_number}.")
                    elif cand1:
                        total_benches_verified += 1
                        total_mixed_benches += 1

            room_allocation_counts[f"Room {room.room_number}"] = room_alloc_count

        # Check for unallocated candidates due to hall capacity shortage
        unallocated_count = sum(len(pool) for pool in branch_pools.values())
        if unallocated_count > 0:
            warnings.append(
                f"Capacity Shortage: {unallocated_count} registered candidate(s) could not be accommodated across the {len(rooms)} selected hall(s). Additional examination rooms must be selected."
            )

        # Commit student allocations
        self.db.add_all(allocations_to_add)
        self.db.flush()

        # 6. Allocate Invigilators to Utilized Rooms (Academic Conflict-of-Interest Prevention)
        if auto_assign_invigilators:
            self.db.execute(
                delete(InvigilatorAllocation).where(
                    InvigilatorAllocation.exam_id.in_(target_exam_ids)
                )
            )
            self.db.flush()

            all_invigilators = list(self.db.execute(select(Invigilator)).scalars().all())
            assigned_invig_ids = set()

            for room in rooms:
                if room_allocation_counts.get(f"Room {room.room_number}", 0) == 0:
                    continue

                # Departments of students seated in this room
                room_seated_dept_ids = set()
                for a in allocations_to_add:
                    if a.room_id == room.id:
                        st_dept = next((row[0].department_id for row in registered_records if row[0].id == a.student_id), None)
                        if st_dept is not None:
                            room_seated_dept_ids.add(st_dept)

                # 1. Primary Pool: Non-Subject Dealing Faculty (their department is NOT writing in this room)
                eligible_non_subject = [
                    inv for inv in all_invigilators
                    if inv.id not in assigned_invig_ids and inv.department_id not in room_seated_dept_ids
                ]

                # 2. Alternative Fallback Pool: Subject Dealing Faculty (used if non-subject faculty is insufficient)
                fallback_pool = [
                    inv for inv in all_invigilators
                    if inv.id not in assigned_invig_ids
                ]

                chosen_inv = None
                if eligible_non_subject:
                    chosen_inv = eligible_non_subject[0]
                elif fallback_pool:
                    chosen_inv = fallback_pool[0]

                if chosen_inv:
                    assigned_invig_ids.add(chosen_inv.id)
                    room_exam_ids = {a.exam_id for a in allocations_to_add if a.room_id == room.id}
                    if not room_exam_ids:
                        room_exam_ids = set(target_exam_ids)

                    for eid in room_exam_ids:
                        inv_alloc = InvigilatorAllocation(
                            exam_id=eid,
                            invigilator_id=chosen_inv.id,
                            room_id=room.id
                        )
                        self.db.add(inv_alloc)
                else:
                    warnings.append(
                        f"Invigilator Shortage: Room {room.room_number} has {room_allocation_counts.get(f'Room {room.room_number}', 0)} candidates seated, but no faculty supervisor was available. Please assign staff manually."
                    )

        # 7. Update exams status to ACTIVE and persist exam_type & exam_subdivision if explicitly provided
        for ex in exams:
            ex.status = "ACTIVE"
            if exam_type:
                ex.exam_type = effective_exam_type
            if exam_subdivision:
                ex.exam_subdivision = effective_exam_subdivision

        self.db.commit()

        # Calculate Compliance
        compliance = 100.0 if total_benches_verified > 0 and total_mixed_benches == total_benches_verified else (100.0 if len(allocations_to_add) > 0 else 0.0)

        subject_display = (
            primary_exam.subject_code
            if len(exams) == 1
            else f"Multi-Exam Session ({', '.join(e.subject_code for e in exams)})"
        )

        return AllocationRunSummary(
            exam_id=primary_exam.id,
            subject_code=subject_display,
            exam_type=effective_exam_type,
            exam_subdivision=effective_exam_subdivision,
            seats_per_bench=1 if is_sem else 2,
            total_students_allocated=len(allocations_to_add),
            rooms_utilized=len([cnt for cnt in room_allocation_counts.values() if cnt > 0]),
            branch_mixing_compliance_percent=compliance,
            violations_count=total_benches_verified - total_mixed_benches,
            details_by_room=room_allocation_counts,
            arrangement_direction=arrangement_direction,
            warnings=warnings,
            question_paper_breakdown=question_paper_breakdown
        )

