from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.api.deps import require_role, get_current_user
from app.core.security import get_password_hash
from app.models.user import User
from app.models.academic import Invigilator, Department
from app.models.seating import InvigilatorAllocation, AttendanceRecord, StudentAllocation
from app.models.exam import Exam
from app.models.infrastructure import Room
from app.schemas.invigilator import InvigilatorCreate, InvigilatorResponse, DutyAssignmentResponse, DutyAssignRequest

router = APIRouter()

@router.get("/", response_model=List[InvigilatorResponse])
def list_invigilators(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    List faculty invigilators with their assigned duties.
    Restricted to ROOT administrators.
    """
    invigilators = db.execute(select(Invigilator)).scalars().all()
    results = []
    for inv in invigilators:
        dept = db.execute(select(Department).where(Department.id == inv.department_id)).scalar_one_or_none()
        
        # Check active assignment
        alloc = db.execute(
            select(InvigilatorAllocation).where(InvigilatorAllocation.invigilator_id == inv.id)
        ).scalars().first()
        room_str = None
        if alloc:
            room = db.execute(select(Room).where(Room.id == alloc.room_id)).scalar_one_or_none()
            if room:
                room_str = f"Room {room.room_number} ({room.block})"

        results.append(
            InvigilatorResponse(
                id=inv.id,
                user_id=inv.user_id,
                faculty_id=inv.faculty_id,
                name=inv.name,
                department_id=inv.department_id,
                department_code=dept.code if dept else None,
                designation=inv.designation,
                email=inv.email,
                phone=inv.phone,
                assigned_room=room_str
            )
        )
    return results

@router.post("/", response_model=InvigilatorResponse, status_code=status.HTTP_201_CREATED)
def create_invigilator(
    payload: InvigilatorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Register a faculty invigilator and generate login credentials.
    Restricted to ROOT administrators.
    """
    existing = db.execute(select(Invigilator).where(Invigilator.faculty_id == payload.faculty_id)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"Faculty with ID '{payload.faculty_id}' already exists.")

    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required when creating an invigilator account.")

    # Create User account
    user = User(
        email=payload.email,
        username=payload.faculty_id,
        hashed_password=get_password_hash(payload.password),
        role="INVIGILATOR",
        full_name=payload.name
    )
    db.add(user)
    db.flush()

    inv = Invigilator(
        user_id=user.id,
        faculty_id=payload.faculty_id,
        name=payload.name,
        department_id=payload.department_id,
        designation=payload.designation,
        email=payload.email,
        phone=payload.phone
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    dept = db.execute(select(Department).where(Department.id == inv.department_id)).scalar_one_or_none()
    return InvigilatorResponse(
        id=inv.id,
        user_id=inv.user_id,
        faculty_id=inv.faculty_id,
        name=inv.name,
        department_id=inv.department_id,
        department_code=dept.code if dept else None,
        designation=inv.designation,
        email=inv.email,
        phone=inv.phone
    )

@router.post("/assign", response_model=DutyAssignmentResponse)
def assign_invigilator_duty(
    payload: DutyAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Manually assign or reassign a faculty invigilator to an examination hall.
    Restricted to ROOT administrators.
    """
    from sqlalchemy import delete

    inv = db.execute(select(Invigilator).where(Invigilator.id == payload.invigilator_id)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invigilator not found.")

    room = db.execute(select(Room).where(Room.id == payload.room_id)).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Examination hall not found.")

    # Determine target exams
    if payload.exam_id:
        target_exam_ids = [payload.exam_id]
    else:
        # Check active session exams
        session_exams = db.execute(
            select(Exam.id).where(Exam.status.in_(["ACTIVE", "SCHEDULED"]))
        ).scalars().all()
        target_exam_ids = list(session_exams)

    if not target_exam_ids:
        # Fallback to all exams
        all_ex = db.execute(select(Exam.id)).scalars().all()
        target_exam_ids = list(all_ex)

    # Remove prior allocation for this invigilator in these exams
    db.execute(
        delete(InvigilatorAllocation).where(
            InvigilatorAllocation.invigilator_id == inv.id,
            InvigilatorAllocation.exam_id.in_(target_exam_ids)
        )
    )
    db.flush()

    # Assign to target exams
    for eid in target_exam_ids:
        alloc = InvigilatorAllocation(
            exam_id=eid,
            invigilator_id=inv.id,
            room_id=room.id
        )
        db.add(alloc)
    db.commit()

    # Return duty response
    primary_exam = db.execute(select(Exam).where(Exam.id == target_exam_ids[0])).scalar_one_or_none()

    total_students = db.execute(
        select(StudentAllocation).where(
            StudentAllocation.room_id == room.id,
            StudentAllocation.exam_id.in_(target_exam_ids)
        )
    ).scalars().all()

    return DutyAssignmentResponse(
        id=inv.id,
        exam_id=primary_exam.id if primary_exam else 1,
        subject_code=primary_exam.subject_code if primary_exam else "DUTY",
        subject_name=primary_exam.subject_name if primary_exam else "Hall Duty",
        exam_date=primary_exam.exam_date if primary_exam else "2026-09-28",
        time_slot=f"{primary_exam.start_time} - {primary_exam.end_time}" if primary_exam else "10:00 AM - 01:00 PM",
        room_id=room.id,
        room_number=room.room_number,
        block=room.block,
        total_students=len(total_students),
        present_count=len(total_students),
        absent_count=0
    )

@router.get("/my-duties", response_model=List[DutyAssignmentResponse])
def get_my_duties(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["INVIGILATOR"]))
):
    """
    Fetch examination duties assigned to the authenticated faculty invigilator.
    Restricted to INVIGILATOR role.
    """
    inv = db.execute(select(Invigilator).where(Invigilator.user_id == current_user.id)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invigilator profile not linked to user account.")

    allocations = db.execute(
        select(InvigilatorAllocation).where(InvigilatorAllocation.invigilator_id == inv.id)
    ).scalars().all()

    seen_room_exams = set()
    duties = []
    for alloc in allocations:
        exam = db.execute(select(Exam).where(Exam.id == alloc.exam_id)).scalar_one_or_none()
        room = db.execute(select(Room).where(Room.id == alloc.room_id)).scalar_one_or_none()
        if not exam or not room:
            continue

        room_key = (room.id, exam.exam_date, exam.session)
        if room_key in seen_room_exams:
            continue
        seen_room_exams.add(room_key)

        session_exams = db.execute(
            select(Exam).where(Exam.exam_date == exam.exam_date, Exam.session == exam.session)
        ).scalars().all()
        concurrent_exam_ids = [e.id for e in session_exams]

        # Count total students in this room across all concurrent exams
        total_students = db.execute(
            select(StudentAllocation).where(
                StudentAllocation.room_id == room.id,
                StudentAllocation.exam_id.in_(concurrent_exam_ids)
            )
        ).scalars().all()
        total_count = len(total_students)

        # Attendance count
        present_count = db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.room_id == room.id,
                AttendanceRecord.exam_id.in_(concurrent_exam_ids),
                AttendanceRecord.status == "PRESENT"
            )
        ).scalars().all()

        absent_count = db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.room_id == room.id,
                AttendanceRecord.exam_id.in_(concurrent_exam_ids),
                AttendanceRecord.status == "ABSENT"
            )
        ).scalars().all()

        subj_code_disp = exam.subject_code if len(session_exams) <= 1 else f"Multi-Exam ({', '.join(e.subject_code for e in session_exams)})"
        subj_name_disp = exam.subject_name if len(session_exams) <= 1 else "Autonomous Multi-Branch Examination Session"

        duties.append(
            DutyAssignmentResponse(
                id=alloc.id,
                exam_id=exam.id,
                subject_code=subj_code_disp,
                subject_name=subj_name_disp,
                exam_date=exam.exam_date,
                time_slot=f"{exam.start_time} - {exam.end_time}",
                room_id=room.id,
                room_number=room.room_number,
                block=room.block,
                total_students=total_count,
                present_count=len(present_count),
                absent_count=len(absent_count)
            )
        )
    return duties

@router.delete("/{invigilator_id}", status_code=status.HTTP_200_OK)
def delete_invigilator(
    invigilator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Permanently remove a faculty invigilator, their duty allocations, and linked user account.
    Restricted to ROOT administrators.
    """
    from sqlalchemy import delete as sql_delete
    inv = db.execute(select(Invigilator).where(Invigilator.id == invigilator_id)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail=f"Invigilator with ID {invigilator_id} not found.")

    # Remove duty allocations first
    db.execute(sql_delete(InvigilatorAllocation).where(InvigilatorAllocation.invigilator_id == inv.id))

    # Remove linked user account
    if inv.user_id:
        user = db.execute(select(User).where(User.id == inv.user_id)).scalar_one_or_none()
        if user:
            db.delete(user)

    db.delete(inv)
    db.commit()
    return {"message": f"Invigilator '{inv.name}' ({inv.faculty_id}) and all duty assignments have been permanently removed."}

