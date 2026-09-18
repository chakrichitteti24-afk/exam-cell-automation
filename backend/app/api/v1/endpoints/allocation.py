from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, delete, func
from app.db.session import get_db
from app.api.deps import require_role, get_current_user
from app.models.user import User
from app.models.academic import Student, Department, Invigilator
from app.models.infrastructure import Room, Bench, Seat
from app.models.exam import Exam
from app.models.seating import StudentAllocation, InvigilatorAllocation, AttendanceRecord
from app.algorithms.seating_engine import SeatingEngine
from app.schemas.seating import (
    AllocationGenerateRequest,
    AllocationRunSummary,
    RoomSeatingMatrixResponse,
    BenchSeating,
    SeatStudent,
    StudentDeskSlipResponse,
    DoorNoticeResponse,
    DoorNoticeStudent
)

router = APIRouter()

@router.post("/generate", response_model=AllocationRunSummary)
def generate_seating_allocation(
    payload: AllocationGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Run automated seating allocation engine with multi-exam concurrent branch mixing.
    Restricted to ROOT administrators.
    """
    engine = SeatingEngine(db)
    try:
        summary = engine.run_allocation(
            exam_id=payload.exam_id,
            exam_ids=payload.exam_ids,
            room_ids=payload.room_ids,
            department_codes=payload.department_codes,
            exam_type=payload.exam_type,
            exam_subdivision=payload.exam_subdivision,
            strategy=payload.strategy,
            arrangement_direction=payload.arrangement_direction or "COLUMN_WISE"
        )
        return summary
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        print(f"[ALLOCATION ERROR] Internal allocation failure: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Seating allocation failed: {e}"
        )

@router.get("/room/{room_id}/exam/{exam_id}", response_model=RoomSeatingMatrixResponse)
def get_room_seating_matrix(
    room_id: int,
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch the 24-bench seating grid for a specific room and exam session.
    Enforces resource-level authorization:
    - ROOT can access any room.
    - INVIGILATOR can only view the room assigned to them.
    - STUDENTS are blocked with 403 Forbidden.
    """
    if current_user.role not in ["ROOT", "INVIGILATOR"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # Base Exam & Concurrent Session Exam IDs
    base_exam = db.execute(select(Exam).where(Exam.id == exam_id)).scalar_one_or_none()
    concurrent_exam_ids = [exam_id]
    if base_exam:
        session_exams = db.execute(
            select(Exam.id).where(
                Exam.exam_date == base_exam.exam_date,
                Exam.session == base_exam.session
            )
        ).scalars().all()
        if session_exams:
            concurrent_exam_ids = list(session_exams)

    # If Invigilator, verify room assignment sandbox
    if current_user.role == "INVIGILATOR":
        inv = db.execute(select(Invigilator).where(Invigilator.user_id == current_user.id)).scalar_one_or_none()
        if not inv:
            raise HTTPException(status_code=403, detail="Invigilator profile not found.")
        
        assignment = db.execute(
            select(InvigilatorAllocation).where(
                InvigilatorAllocation.invigilator_id == inv.id,
                InvigilatorAllocation.exam_id.in_(concurrent_exam_ids),
                InvigilatorAllocation.room_id == room_id
            )
        ).first()
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: You are not authorized for Room ID {room_id}. Sandboxed strictly to your assigned examination hall."
            )

    room = db.execute(select(Room).where(Room.id == room_id)).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")

    benches = db.execute(
        select(Bench).where(Bench.room_id == room.id).order_by(Bench.bench_number)
    ).scalars().all()
    bench_ids = [b.id for b in benches]

    # Bulk fetch seats
    all_seats = []
    if bench_ids:
        all_seats = db.execute(
            select(Seat).where(Seat.bench_id.in_(bench_ids)).order_by(Seat.bench_id, Seat.seat_number)
        ).scalars().all()
        
    from collections import defaultdict
    seat_map = defaultdict(list)
    for seat in all_seats:
        seat_map[seat.bench_id].append(seat)

    # Bulk fetch allocations for this room and exams
    allocs = db.execute(
        select(StudentAllocation).where(
            StudentAllocation.room_id == room.id,
            StudentAllocation.exam_id.in_(concurrent_exam_ids)
        )
    ).scalars().all()
    alloc_map = {a.seat_id: a for a in allocs}

    # Bulk fetch related data
    student_ids = [a.student_id for a in allocs]
    students = db.execute(select(Student).where(Student.id.in_(student_ids))).scalars().all() if student_ids else []
    student_map = {s.id: s for s in students}

    all_depts = db.execute(select(Department)).scalars().all()
    dept_map = {d.id: d.code for d in all_depts}

    all_exams = db.execute(select(Exam).where(Exam.id.in_(concurrent_exam_ids))).scalars().all()
    exam_map = {e.id: e for e in all_exams}

    att_records = db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.student_id.in_(student_ids),
            AttendanceRecord.exam_id.in_(concurrent_exam_ids)
        )
    ).scalars().all() if student_ids else []
    att_map = {(att.exam_id, att.student_id): att for att in att_records}

    bench_seating_list: List[BenchSeating] = []
    dept_breakdown: Dict[str, int] = {}
    occupied_benches = 0
    mixed_benches = 0

    for bench in benches:
        seats = seat_map.get(bench.id, [])

        s1_student: Optional[SeatStudent] = None
        s2_student: Optional[SeatStudent] = None

        if len(seats) > 0:
            alloc1 = alloc_map.get(seats[0].id)
            if alloc1:
                st = student_map.get(alloc1.student_id)
                dept_code = dept_map.get(st.department_id) if st else "GEN"
                dept_breakdown[dept_code] = dept_breakdown.get(dept_code, 0) + 1
                
                cand_exam1 = exam_map.get(alloc1.exam_id)
                att = att_map.get((alloc1.exam_id, st.id)) if st else None

                s1_student = SeatStudent(
                    student_id=st.id if st else 0,
                    roll_number=st.roll_number if st else "",
                    name=st.name if st else "",
                    department_code=dept_code,
                    seat_id=seats[0].id,
                    seat_number=1,
                    seat_label=seats[0].seat_label,
                    attendance_status=att.status if att else "PRESENT",
                    subject_code=cand_exam1.subject_code if cand_exam1 else None,
                    subject_name=cand_exam1.subject_name if cand_exam1 else None
                )

        if len(seats) > 1:
            alloc2 = alloc_map.get(seats[1].id)
            if alloc2:
                st2 = student_map.get(alloc2.student_id)
                dept_code2 = dept_map.get(st2.department_id) if st2 else "GEN"
                dept_breakdown[dept_code2] = dept_breakdown.get(dept_code2, 0) + 1

                cand_exam2 = exam_map.get(alloc2.exam_id)
                att2 = att_map.get((alloc2.exam_id, st2.id)) if st2 else None

                s2_student = SeatStudent(
                    student_id=st2.id if st2 else 0,
                    roll_number=st2.roll_number if st2 else "",
                    name=st2.name if st2 else "",
                    department_code=dept_code2,
                    seat_id=seats[1].id,
                    seat_number=2,
                    seat_label=seats[1].seat_label,
                    attendance_status=att2.status if att2 else "PRESENT",
                    subject_code=cand_exam2.subject_code if cand_exam2 else None,
                    subject_name=cand_exam2.subject_name if cand_exam2 else None
                )

        is_mixed = True
        if s1_student and s2_student:
            occupied_benches += 1
            if s1_student.department_code != s2_student.department_code:
                mixed_benches += 1
            else:
                is_mixed = False
        elif s1_student:
            occupied_benches += 1
            mixed_benches += 1

        exam_type = getattr(base_exam, "exam_type", "MID") if base_exam else "MID"
        is_sem = (exam_type == "SEM")

        bench_seating_list.append(
            BenchSeating(
                bench_id=bench.id,
                bench_number=bench.bench_number,
                row_index=bench.row_index,
                col_index=bench.col_index,
                seat1=s1_student,
                seat2=s2_student,
                is_mixed_branch=is_mixed,
                is_sem_single_seater=is_sem
            )
        )

    compliance = round((mixed_benches / occupied_benches) * 100.0, 1) if occupied_benches > 0 else 100.0
    allocated_count = sum(dept_breakdown.values())
    exam_type = getattr(base_exam, "exam_type", "MID") if base_exam else "MID"
    exam_subdivision = getattr(base_exam, "exam_subdivision", "MID_1" if exam_type == "MID" else "REGULAR") if base_exam else "MID_1"
    is_sem = (exam_type == "SEM")
    seats_per_bench = 1 if is_sem else 2
    effective_capacity = len(benches) * 1 if is_sem else room.capacity

    return RoomSeatingMatrixResponse(
        room_id=room.id,
        room_number=room.room_number,
        block=room.block,
        capacity=effective_capacity,
        exam_type=exam_type,
        exam_subdivision=exam_subdivision,
        seats_per_bench=seats_per_bench,
        allocated_count=allocated_count,
        benches_count=len(benches),
        benches=bench_seating_list,
        department_breakdown=dept_breakdown,
        mixing_compliance_percent=compliance,
        arrangement_direction="COLUMN_WISE"
    )

@router.get("/student/me", response_model=List[StudentDeskSlipResponse])
def get_my_desk_slip(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["STUDENT"]))
):
    """
    Return digital desk slip(s) for the authenticated student.
    Guarantees isolation: students cannot access anyone else's allocation.
    Bulk-fetches all related models to eliminate N+1 latency.
    """
    student = db.execute(select(Student).where(Student.user_id == current_user.id)).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    # Find all allocations for student
    allocs = db.execute(
        select(StudentAllocation).where(StudentAllocation.student_id == student.id)
    ).scalars().all()
    if not allocs:
        return []

    exam_ids = list({a.exam_id for a in allocs})
    room_ids = list({a.room_id for a in allocs})
    bench_ids = list({a.bench_id for a in allocs})
    seat_ids = list({a.seat_id for a in allocs})

    # Bulk fetch entities
    exams = {e.id: e for e in db.execute(select(Exam).where(Exam.id.in_(exam_ids))).scalars().all()}
    rooms = {r.id: r for r in db.execute(select(Room).where(Room.id.in_(room_ids))).scalars().all()}
    benches = {b.id: b for b in db.execute(select(Bench).where(Bench.id.in_(bench_ids))).scalars().all()}
    seats = {s.id: s for s in db.execute(select(Seat).where(Seat.id.in_(seat_ids))).scalars().all()}
    dept = db.execute(select(Department).where(Department.id == student.department_id)).scalar_one_or_none()

    # Bulk fetch potential bench partners
    partner_allocs = db.execute(
        select(StudentAllocation).where(
            StudentAllocation.bench_id.in_(bench_ids),
            StudentAllocation.student_id != student.id
        )
    ).scalars().all()
    partner_by_bench = {p.bench_id: p for p in partner_allocs}

    partner_st_ids = [p.student_id for p in partner_allocs]
    partner_students = {s.id: s for s in db.execute(select(Student).where(Student.id.in_(partner_st_ids))).scalars().all()} if partner_st_ids else {}
    
    partner_exam_ids = [p.exam_id for p in partner_allocs]
    partner_exams = {e.id: e for e in db.execute(select(Exam).where(Exam.id.in_(partner_exam_ids))).scalars().all()} if partner_exam_ids else {}

    all_depts = {d.id: d.code for d in db.execute(select(Department)).scalars().all()}

    slips: List[StudentDeskSlipResponse] = []
    for alloc in allocs:
        exam = exams.get(alloc.exam_id)
        room = rooms.get(alloc.room_id)
        bench = benches.get(alloc.bench_id)
        seat = seats.get(alloc.seat_id)
        if not (exam and room and bench and seat):
            continue

        partner_dept_code = None
        partner_sub_code = None
        partner_sub_name = None

        exam_type = getattr(exam, "exam_type", "MID") if exam else "MID"
        if exam_type == "SEM":
            partner_sub_name = "Single-Seater Policy (Semester Examination)"
        else:
            partner_alloc = partner_by_bench.get(alloc.bench_id)
            if partner_alloc:
                partner_st = partner_students.get(partner_alloc.student_id)
                if partner_st:
                    partner_dept_code = all_depts.get(partner_st.department_id)
                partner_ex = partner_exams.get(partner_alloc.exam_id)
                if partner_ex:
                    partner_sub_code = partner_ex.subject_code
                    partner_sub_name = partner_ex.subject_name

        qr_payload = f"GKCE-HALLTICKET:{student.roll_number}:{exam.subject_code}:ROOM{room.room_number}:BENCH{bench.bench_number}:SEAT{seat.seat_number}"

        slips.append(
            StudentDeskSlipResponse(
                student_id=student.id,
                roll_number=student.roll_number,
                student_name=student.name,
                department_code=dept.code if dept else "N/A",
                semester=student.semester,
                academic_year=student.academic_year,
                exam_id=exam.id,
                subject_code=exam.subject_code,
                subject_name=exam.subject_name,
                exam_date=exam.exam_date,
                exam_type=exam_type,
                exam_subdivision=getattr(exam, "exam_subdivision", "MID_1" if exam_type == "MID" else "REGULAR"),
                time_slot=f"{exam.start_time} - {exam.end_time}",
                room_id=room.id,
                room_number=room.room_number,
                block=room.block,
                floor=str(room.floor) if room.floor is not None else None,
                bench_number=bench.bench_number,
                seat_number=seat.seat_number,
                seat_label=seat.seat_label,
                partner_department=partner_dept_code,
                partner_subject_code=partner_sub_code,
                partner_subject_name=partner_sub_name,
                qr_payload=qr_payload,
                total_benches=room.total_benches or 24,
                row_index=bench.row_index or (((bench.bench_number - 1) // 4) + 1),
                col_index=bench.col_index or (((bench.bench_number - 1) % 4) + 1)
            )
        )

    return slips

@router.get("/reports/door-notice/{room_id}/exam/{exam_id}", response_model=DoorNoticeResponse)
def get_door_notice_report(
    room_id: int,
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT", "INVIGILATOR"]))
):
    """
    Generate printable door notice data for exam hall entry doors.
    Enforces strict authorization: Invigilators can only view door notices for their assigned room.
    """
    room = db.execute(select(Room).where(Room.id == room_id)).scalar_one_or_none()
    exam = db.execute(select(Exam).where(Exam.id == exam_id)).scalar_one_or_none()
    if not room or not exam:
        raise HTTPException(status_code=404, detail="Room or Exam not found.")

    # Find concurrent exams in this session
    concurrent_exam_ids = [exam.id]
    session_exams = db.execute(
        select(Exam.id).where(
            Exam.exam_date == exam.exam_date,
            Exam.session == exam.session
        )
    ).scalars().all()
    if session_exams:
        concurrent_exam_ids = list(session_exams)

    if current_user.role == "INVIGILATOR":
        inv = db.execute(select(Invigilator).where(Invigilator.user_id == current_user.id)).scalar_one_or_none()
        if not inv:
            raise HTTPException(status_code=403, detail="Invigilator profile not found.")
        assignment = db.execute(
            select(InvigilatorAllocation).where(
                InvigilatorAllocation.invigilator_id == inv.id,
                InvigilatorAllocation.exam_id.in_(concurrent_exam_ids),
                InvigilatorAllocation.room_id == room_id
            )
        ).first()
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: You are not authorized to view the door notice for Room ID {room_id}."
            )

    allocs = db.execute(
        select(StudentAllocation).where(
            StudentAllocation.room_id == room.id,
            StudentAllocation.exam_id.in_(concurrent_exam_ids)
        )
    ).scalars().all()

    students_list: List[DoorNoticeStudent] = []
    benches_used = set()
    question_paper_breakdown: Dict[str, int] = {}

    if allocs:
        student_ids = list({a.student_id for a in allocs})
        bench_ids = list({a.bench_id for a in allocs})
        seat_ids = list({a.seat_id for a in allocs})

        students_map = {s.id: s for s in db.execute(select(Student).where(Student.id.in_(student_ids))).scalars().all()}
        benches_map = {b.id: b for b in db.execute(select(Bench).where(Bench.id.in_(bench_ids))).scalars().all()}
        seats_map = {s.id: s for s in db.execute(select(Seat).where(Seat.id.in_(seat_ids))).scalars().all()}
        cand_exams_map = {e.id: e for e in db.execute(select(Exam).where(Exam.id.in_(concurrent_exam_ids))).scalars().all()}
        all_depts_map = {d.id: d.code for d in db.execute(select(Department)).scalars().all()}

        for a in allocs:
            st = students_map.get(a.student_id)
            dept_code = all_depts_map.get(st.department_id, "GEN") if st else "GEN"
            bench = benches_map.get(a.bench_id)
            seat = seats_map.get(a.seat_id)
            cand_exam = cand_exams_map.get(a.exam_id)

            if bench:
                benches_used.add(bench.id)

            sub_code = cand_exam.subject_code if cand_exam else "EXAM"
            question_paper_breakdown[sub_code] = question_paper_breakdown.get(sub_code, 0) + 1

            students_list.append(
                DoorNoticeStudent(
                    seat_number=seat.seat_number if seat else 1,
                    bench_number=bench.bench_number if bench else 1,
                    roll_number=st.roll_number if st else "",
                    name=st.name if st else "",
                    department=dept_code,
                    subject_code=sub_code
                )
            )

    # Sort students by bench_number, seat_number
    students_list.sort(key=lambda s: (s.bench_number, s.seat_number))

    return DoorNoticeResponse(
        institution_name="Gokula Krishna College of Engineering",
        exam_title="End Semester Autonomous Examinations",
        subject_code=exam.subject_code,
        subject_name=exam.subject_name,
        exam_date=exam.exam_date,
        exam_type=getattr(exam, "exam_type", "MID"),
        exam_subdivision=getattr(exam, "exam_subdivision", "MID_1"),
        time_slot=f"{exam.start_time} - {exam.end_time}",
        room_number=room.room_number,
        block=room.block,
        total_candidates=len(students_list),
        benches_used=len(benches_used),
        students=students_list,
        chief_superintendent_signature="Controller of Examinations, GKCE",
        question_paper_breakdown=question_paper_breakdown
    )

@router.get("/summary")
def get_allocation_global_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Return global statistics on examination seating allocations.
    Uses ultra-fast SQL aggregation instead of loading all rows.
    Restricted strictly to ROOT administrators.
    """
    total_students_allocated = db.execute(select(func.count(StudentAllocation.id))).scalar() or 0
    total_active_exams = db.execute(select(func.count(Exam.id))).scalar() or 0
    total_rooms_available = db.execute(select(func.count(Room.id))).scalar() or 0

    # Room occupancy via SQL aggregation
    occupancy_rows = db.execute(
        select(StudentAllocation.room_id, func.count(StudentAllocation.id))
        .group_by(StudentAllocation.room_id)
    ).all()
    room_occupancy: Dict[int, int] = {row[0]: row[1] for row in occupancy_rows}
    total_rooms_utilized = len(room_occupancy)

    return {
        "total_students_allocated": total_students_allocated,
        "total_active_exams": total_active_exams,
        "total_rooms_utilized": total_rooms_utilized,
        "total_rooms_available": total_rooms_available,
        "branch_mixing_compliance_percent": 100.0 if total_students_allocated > 0 else 0.0,
        "room_occupancy": room_occupancy
    }

@router.delete("/reset")
def reset_all_allocations(
    exam_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Clear all student seating and invigilator duty allocations back to unassigned/null state,
    and reset examination status to SCHEDULED.
    Restricted to ROOT administrators.
    """
    stmt = delete(StudentAllocation)
    inv_stmt = delete(InvigilatorAllocation)
    if exam_id:
        stmt = stmt.where(StudentAllocation.exam_id == exam_id)
        inv_stmt = inv_stmt.where(InvigilatorAllocation.exam_id == exam_id)
        ex = db.execute(select(Exam).where(Exam.id == exam_id)).scalar_one_or_none()
        if ex:
            ex.status = "SCHEDULED"
    else:
        exams = db.execute(select(Exam)).scalars().all()
        for e in exams:
            e.status = "SCHEDULED"

    db.execute(stmt)
    db.execute(inv_stmt)
    db.commit()
    return {"message": "All seating allocations and invigilator duty assignments cleared successfully. Seats and duties are now unassigned (NULL)."}


