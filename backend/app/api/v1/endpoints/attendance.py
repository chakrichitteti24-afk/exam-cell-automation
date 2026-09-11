from datetime import datetime, timezone
from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.api.deps import require_role, get_current_user
from app.models.user import User
from app.models.academic import Invigilator, Student
from app.models.seating import AttendanceRecord, InvigilatorAllocation, StudentAllocation
from app.schemas.seating import AttendanceUpdateRequest

router = APIRouter()

@router.post("/mark")
def mark_student_attendance(
    payload: AttendanceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT", "INVIGILATOR"]))
):
    """
    Mark student examination attendance (PRESENT, ABSENT, MALPRACTICE).
    Enforces room sandboxing for invigilators: must be assigned to this room.
    """
    inv_id = None
    if current_user.role == "INVIGILATOR":
        inv = db.execute(select(Invigilator).where(Invigilator.user_id == current_user.id)).scalar_one_or_none()
        if not inv:
            raise HTTPException(status_code=403, detail="Invigilator profile not found.")
        inv_id = inv.id

        # Verify duty assignment in this room
        assignment = db.execute(
            select(InvigilatorAllocation).where(
                InvigilatorAllocation.invigilator_id == inv.id,
                InvigilatorAllocation.exam_id == payload.exam_id,
                InvigilatorAllocation.room_id == payload.room_id
            )
        ).scalar_one_or_none()
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: You are not authorized to mark attendance for this room."
            )

    # Verify student is allocated in this room
    alloc = db.execute(
        select(StudentAllocation).where(
            StudentAllocation.exam_id == payload.exam_id,
            StudentAllocation.student_id == payload.student_id,
            StudentAllocation.room_id == payload.room_id
        )
    ).scalar_one_or_none()
    if not alloc:
        raise HTTPException(
            status_code=400,
            detail="Student is not allocated in this examination room."
        )

    # Upsert attendance record
    record = db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.exam_id == payload.exam_id,
            AttendanceRecord.student_id == payload.student_id
        )
    ).scalar_one_or_none()

    if not record:
        record = AttendanceRecord(
            exam_id=payload.exam_id,
            student_id=payload.student_id,
            room_id=payload.room_id,
            status=payload.status,
            marked_by_invigilator_id=inv_id,
            marked_at=datetime.now(timezone.utc)
        )
        db.add(record)
    else:
        record.status = payload.status
        record.room_id = payload.room_id
        record.marked_by_invigilator_id = inv_id
        record.marked_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(record)

    return {
        "success": True,
        "student_id": payload.student_id,
        "status": record.status,
        "marked_at": record.marked_at.isoformat()
    }

@router.get("/exam/{exam_id}/room/{room_id}")
def get_room_attendance_summary(
    exam_id: int,
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT", "INVIGILATOR"]))
):
    """
    Get summary headcount of present, absent, and total candidates in a room.
    Enforces room sandboxing for invigilators.
    """
    if current_user.role == "INVIGILATOR":
        inv = db.execute(select(Invigilator).where(Invigilator.user_id == current_user.id)).scalar_one_or_none()
        if not inv:
            raise HTTPException(status_code=403, detail="Invigilator profile not found.")
        assignment = db.execute(
            select(InvigilatorAllocation).where(
                InvigilatorAllocation.invigilator_id == inv.id,
                InvigilatorAllocation.exam_id == exam_id,
                InvigilatorAllocation.room_id == room_id
            )
        ).scalar_one_or_none()
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: You are not authorized to view attendance for unassigned rooms."
            )

    allocs = db.execute(
        select(StudentAllocation).where(
            StudentAllocation.exam_id == exam_id,
            StudentAllocation.room_id == room_id
        )
    ).scalars().all()

    student_ids = [a.student_id for a in allocs]
    total_allocated = len(student_ids)

    records = db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.exam_id == exam_id,
            AttendanceRecord.student_id.in_(student_ids)
        )
    ).scalars().all()

    present_count = sum(1 for r in records if r.status == "PRESENT")
    absent_count = sum(1 for r in records if r.status == "ABSENT")
    malpractice_count = sum(1 for r in records if r.status == "MALPRACTICE")

    # If some candidates don't have records yet, default them to present
    unrecorded = total_allocated - len(records)
    present_count += unrecorded

    return {
        "room_id": room_id,
        "exam_id": exam_id,
        "total_allocated": total_allocated,
        "present_count": present_count,
        "absent_count": absent_count,
        "malpractice_count": malpractice_count
    }
