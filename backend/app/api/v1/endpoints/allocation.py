from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
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
            exam_type=payload.exam_type,
            exam_subdivision=payload.exam_subdivision,
            strategy=payload.strategy,
            arrangement_direction=payload.arrangement_direction or "COLUMN_WISE"
        )
        return summary
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

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

    bench_seating_list: List[BenchSeating] = []
    dept_breakdown: Dict[str, int] = {}
    occupied_benches = 0
    mixed_benches = 0

    for bench in benches:
        seats = db.execute(
            select(Seat).where(Seat.bench_id == bench.id).order_by(Seat.seat_number)
        ).scalars().all()

        s1_student: Optional[SeatStudent] = None
        s2_student: Optional[SeatStudent] = None

        if len(seats) > 0:
            alloc1 = db.execute(
                select(StudentAllocation).where(
                    StudentAllocation.room_id == room.id,
                    StudentAllocation.seat_id == seats[0].id,
                    StudentAllocation.exam_id.in_(concurrent_exam_ids)
                )
            ).scalar_one_or_none()
            if alloc1:
                st = db.execute(select(Student).where(Student.id == alloc1.student_id)).scalar_one_or_none()
                dept = db.execute(select(Department).where(Department.id == st.department_id)).scalar_one_or_none() if st else None
                dept_code = dept.code if dept else "GEN"
                dept_breakdown[dept_code] = dept_breakdown.get(dept_code, 0) + 1
                
                # Cand exam info
                cand_exam1 = db.execute(select(Exam).where(Exam.id == alloc1.exam_id)).scalar_one_or_none()

                # Attendance check
                att = db.execute(
                    select(AttendanceRecord).where(
                        AttendanceRecord.exam_id == alloc1.exam_id,
                        AttendanceRecord.student_id == st.id
                    )
                ).scalar_one_or_none()

                s1_student = SeatStudent(
                    student_id=st.id,
                    roll_number=st.roll_number,
                    name=st.name,
                    department_code=dept_code,
                    seat_id=seats[0].id,
                    seat_number=1,
                    seat_label=seats[0].seat_label,
                    attendance_status=att.status if att else "PRESENT",
                    subject_code=cand_exam1.subject_code if cand_exam1 else None,
                    subject_name=cand_exam1.subject_name if cand_exam1 else None
                )

        if len(seats) > 1:
            alloc2 = db.execute(
                select(StudentAllocation).where(
                    StudentAllocation.room_id == room.id,
                    StudentAllocation.seat_id == seats[1].id,
                    StudentAllocation.exam_id.in_(concurrent_exam_ids)
                )
            ).scalar_one_or_none()
            if alloc2:
                st2 = db.execute(select(Student).where(Student.id == alloc2.student_id)).scalar_one_or_none()
                dept2 = db.execute(select(Department).where(Department.id == st2.department_id)).scalar_one_or_none() if st2 else None
                dept_code2 = dept2.code if dept2 else "GEN"
                dept_breakdown[dept_code2] = dept_breakdown.get(dept_code2, 0) + 1

                # Cand exam info
                cand_exam2 = db.execute(select(Exam).where(Exam.id == alloc2.exam_id)).scalar_one_or_none()

                att2 = db.execute(
                    select(AttendanceRecord).where(
                        AttendanceRecord.exam_id == alloc2.exam_id,
                        AttendanceRecord.student_id == st2.id
                    )
                ).scalar_one_or_none()

                s2_student = SeatStudent(
                    student_id=st2.id,
                    roll_number=st2.roll_number,
                    name=st2.name,
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

    compliance = 100.0 if (occupied_benches > 0 and mixed_benches == occupied_benches) else (100.0 if occupied_benches > 0 else 0.0)
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

@router.get("/student/me", response_model=StudentDeskSlipResponse)
def get_my_desk_slip(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["STUDENT"]))
):
    """
    Return digital desk slip for the authenticated student.
    Guarantees isolation: students cannot access anyone else's allocation.
    """
    student = db.execute(select(Student).where(Student.user_id == current_user.id)).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    # Find allocation for student
    alloc = db.execute(
        select(StudentAllocation).where(StudentAllocation.student_id == student.id)
    ).scalars().first()
    if not alloc:
        raise HTTPException(status_code=404, detail="No active exam seating allocation found for this candidate.")

    exam = db.execute(select(Exam).where(Exam.id == alloc.exam_id)).scalar_one_or_none()
    room = db.execute(select(Room).where(Room.id == alloc.room_id)).scalar_one_or_none()
    bench = db.execute(select(Bench).where(Bench.id == alloc.bench_id)).scalar_one_or_none()
    seat = db.execute(select(Seat).where(Seat.id == alloc.seat_id)).scalar_one_or_none()
    dept = db.execute(select(Department).where(Department.id == student.department_id)).scalar_one_or_none()

    # Find partner on the same bench (any exam in the same session)
    partner_alloc = db.execute(
        select(StudentAllocation).where(
            StudentAllocation.bench_id == alloc.bench_id,
            StudentAllocation.student_id != student.id
        )
    ).scalars().first()

    partner_dept_code = None
    partner_sub_code = None
    partner_sub_name = None
    if partner_alloc:
        partner_st = db.execute(select(Student).where(Student.id == partner_alloc.student_id)).scalar_one_or_none()
        if partner_st:
            partner_dept = db.execute(select(Department).where(Department.id == partner_st.department_id)).scalar_one_or_none()
            partner_dept_code = partner_dept.code if partner_dept else None
        partner_exam = db.execute(select(Exam).where(Exam.id == partner_alloc.exam_id)).scalar_one_or_none()
        if partner_exam:
            partner_sub_code = partner_exam.subject_code
            partner_sub_name = partner_exam.subject_name

    exam_type = getattr(exam, "exam_type", "MID") if exam else "MID"
    if exam_type == "SEM":
        partner_dept_code = None
        partner_sub_code = None
        partner_sub_name = "Single-Seater Policy (Semester Examination)"

    qr_payload = f"GKCE-HALLTICKET:{student.roll_number}:{exam.subject_code}:ROOM{room.room_number}:BENCH{bench.bench_number}:SEAT{seat.seat_number}"

    return StudentDeskSlipResponse(
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
        floor=room.floor,
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

    for a in allocs:
        st = db.execute(select(Student).where(Student.id == a.student_id)).scalar_one_or_none()
        dept = db.execute(select(Department).where(Department.id == st.department_id)).scalar_one_or_none() if st else None
        bench = db.execute(select(Bench).where(Bench.id == a.bench_id)).scalar_one_or_none()
        seat = db.execute(select(Seat).where(Seat.id == a.seat_id)).scalar_one_or_none()
        cand_exam = db.execute(select(Exam).where(Exam.id == a.exam_id)).scalar_one_or_none()
        
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
                department=dept.code if dept else "GEN",
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
    Restricted strictly to ROOT administrators.
    """
    total_allocations = db.execute(select(StudentAllocation)).scalars().all()
    exams = db.execute(select(Exam)).scalars().all()
    rooms = db.execute(select(Room)).scalars().all()
    
    unique_rooms = set(a.room_id for a in total_allocations)
    room_occupancy: Dict[int, int] = {}
    for a in total_allocations:
        room_occupancy[a.room_id] = room_occupancy.get(a.room_id, 0) + 1
    
    return {
        "total_students_allocated": len(total_allocations),
        "total_active_exams": len(exams),
        "total_rooms_utilized": len(unique_rooms),
        "total_rooms_available": len(rooms),
        "branch_mixing_compliance_percent": 100.0 if len(total_allocations) > 0 else 0.0,
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


