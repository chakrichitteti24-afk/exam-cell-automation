from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.api.deps import require_role, get_current_user
from app.core.security import get_password_hash
from app.models.user import User
from app.models.academic import Invigilator, Department, Student
from app.models.seating import InvigilatorAllocation, AttendanceRecord, StudentAllocation
from app.models.exam import Exam
from app.models.infrastructure import Room
from app.schemas.invigilator import InvigilatorCreate, InvigilatorResponse, DutyAssignmentResponse, DutyAssignRequest, DutyAssignResult

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
    
    from sqlalchemy import func
    # Bulk fetch departments
    all_depts = db.execute(select(Department)).scalars().all()
    dept_map = {d.id: d.code for d in all_depts}
    
    # Bulk fetch latest allocations per invigilator (first one)
    inv_ids = [inv.id for inv in invigilators]
    all_allocs = db.execute(
        select(InvigilatorAllocation).where(InvigilatorAllocation.invigilator_id.in_(inv_ids))
    ).scalars().all() if inv_ids else []
    # Map invigilator_id -> first allocation
    alloc_map = {}
    for a in all_allocs:
        if a.invigilator_id not in alloc_map:
            alloc_map[a.invigilator_id] = a

    # Bulk fetch rooms for the allocations
    room_ids = list({a.room_id for a in alloc_map.values()})
    rooms = db.execute(select(Room).where(Room.id.in_(room_ids))).scalars().all() if room_ids else []
    room_map = {r.id: r for r in rooms}

    results = []
    for inv in invigilators:
        dept_code = dept_map.get(inv.department_id)
        alloc = alloc_map.get(inv.id)
        room_str = None
        if alloc:
            room = room_map.get(alloc.room_id)
            if room:
                room_str = f"Room {room.room_number} ({room.block})"

        results.append(
            InvigilatorResponse(
                id=inv.id,
                user_id=inv.user_id,
                faculty_id=inv.faculty_id,
                name=inv.name,
                department_id=inv.department_id,
                department_code=dept_code,
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

    pwd = payload.password or "Faculty@123"

    # Create User account
    user = User(
        email=payload.email,
        username=payload.faculty_id,
        hashed_password=get_password_hash(pwd),
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

@router.post("/assign", response_model=DutyAssignResult)
def assign_invigilator_duty(
    payload: DutyAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Manually assign, reassign, or unassign a faculty invigilator to an examination hall,
    or auto-distribute duties across all utilized halls.
    Restricted to ROOT administrators.
    """
    from sqlalchemy import delete

    # 1. Determine target exams
    if payload.exam_id:
        target_exam_ids = [payload.exam_id]
    else:
        session_exams = db.execute(
            select(Exam.id).where(Exam.status.in_(["ACTIVE", "SCHEDULED"]))
        ).scalars().all()
        target_exam_ids = list(session_exams)

    if not target_exam_ids:
        all_ex = db.execute(select(Exam.id)).scalars().all()
        target_exam_ids = list(all_ex)

    # 2. Case: Auto-distribute
    if payload.auto_distribute:
        import random

        all_rooms = list(db.execute(select(Room).order_by(Room.room_number)).scalars().all())
        all_invigilators = list(db.execute(select(Invigilator)).scalars().all())

        # Determine target rooms (either Root-selected or all rooms)
        if payload.selected_room_ids and len(payload.selected_room_ids) > 0:
            target_rooms = [r for r in all_rooms if r.id in payload.selected_room_ids]
        else:
            target_rooms = all_rooms

        # Determine available faculty pool (strictly Root-selected if provided)
        if payload.selected_invigilator_ids and len(payload.selected_invigilator_ids) > 0:
            available_invigilators = [inv for inv in all_invigilators if inv.id in payload.selected_invigilator_ids]
        else:
            available_invigilators = list(all_invigilators)

        # Randomize the faculty pool order for genuine unbiased random allocation
        shuffled_candidates = list(available_invigilators)
        random.shuffle(shuffled_candidates)

        target_room_ids = [r.id for r in target_rooms]

        # Clear prior duty allocations for target rooms
        db.execute(
            delete(InvigilatorAllocation).where(
                InvigilatorAllocation.exam_id.in_(target_exam_ids),
                InvigilatorAllocation.room_id.in_(target_room_ids)
            )
        )
        db.flush()

        assigned_invig_ids = set()
        assignments = []
        unassigned_rooms = []

        for room in target_rooms:
            # Check if any students allocated to this room
            st_allocs = db.execute(
                select(StudentAllocation).where(
                    StudentAllocation.room_id == room.id,
                    StudentAllocation.exam_id.in_(target_exam_ids)
                )
            ).scalars().all()

            # Find department IDs seated in this room
            seated_dept_ids = set()
            if st_allocs:
                st_ids = [a.student_id for a in st_allocs]
                depts = db.execute(
                    select(Student.department_id).where(Student.id.in_(st_ids))
                ).scalars().all()
                seated_dept_ids = set(depts)

            # Preference 1: Unassigned candidate from shuffled pool whose department is NOT in seated_dept_ids
            eligible_non_subject = [
                inv for inv in shuffled_candidates
                if inv.id not in assigned_invig_ids and inv.department_id not in seated_dept_ids
            ]
            # Preference 2: Fallback unassigned candidate from shuffled pool
            fallback_pool = [
                inv for inv in shuffled_candidates
                if inv.id not in assigned_invig_ids
            ]

            chosen = None
            if eligible_non_subject:
                chosen = eligible_non_subject[0]
            elif fallback_pool:
                chosen = fallback_pool[0]

            if chosen:
                assigned_invig_ids.add(chosen.id)
                assignments.append({
                    "invigilator_id": chosen.id,
                    "invigilator_name": chosen.name,
                    "room_id": room.id,
                    "room_number": room.room_number
                })
                for eid in target_exam_ids:
                    alloc = InvigilatorAllocation(
                        exam_id=eid,
                        invigilator_id=chosen.id,
                        room_id=room.id
                    )
                    db.add(alloc)
            else:
                # Shortage: Room placed on Hold (unassigned)
                unassigned_rooms.append(room)

        db.commit()

        unassigned_room_numbers = [r.room_number for r in unassigned_rooms]
        shortage_count = len(unassigned_room_numbers)

        if shortage_count > 0:
            status_str = "SHORTAGE_HOLD"
            message = (
                f"Randomly allocated {len(assignments)} room(s) from {len(available_invigilators)} selected faculty. "
                f"Shortage detected: {shortage_count} room(s) (Room {', '.join(unassigned_room_numbers)}) placed on HOLD without supervisor. "
                f"Root can assign new faculty or standby staff."
            )
        else:
            status_str = "SUCCESS"
            message = (
                f"Randomly allocated {len(assignments)} room(s) from {len(available_invigilators)} selected faculty "
                f"with conflict-of-interest prevention."
            )

        return DutyAssignResult(
            message=message,
            status=status_str,
            assignments=assignments,
            shortage_count=shortage_count,
            unassigned_rooms=unassigned_room_numbers
        )

    # 3. Case: Manual Assignment or Unassignment
    if not payload.invigilator_id:
        raise HTTPException(status_code=400, detail="invigilator_id is required for manual duty assignment.")

    inv = db.execute(select(Invigilator).where(Invigilator.id == payload.invigilator_id)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invigilator not found.")

    # Remove prior allocations for this invigilator
    db.execute(
        delete(InvigilatorAllocation).where(
            InvigilatorAllocation.invigilator_id == inv.id,
            InvigilatorAllocation.exam_id.in_(target_exam_ids)
        )
    )
    db.flush()

    # If room_id is None, 0, or negative, treat as Unassign (Standby)
    if not payload.room_id or payload.room_id <= 0:
        db.commit()
        return DutyAssignResult(
            message=f"Duty cleared for {inv.name}. Faculty is now on Standby.",
            status="SUCCESS",
            invigilator_id=inv.id,
            invigilator_name=inv.name,
            room_id=None,
            room_number=None,
            assignments=[]
        )

    # Assign to specified room
    room = db.execute(select(Room).where(Room.id == payload.room_id)).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Examination hall not found.")

    # Clear any previous duty assigned to this room for these exams
    db.execute(
        delete(InvigilatorAllocation).where(
            InvigilatorAllocation.room_id == room.id,
            InvigilatorAllocation.exam_id.in_(target_exam_ids)
        )
    )
    db.flush()

    for eid in target_exam_ids:
        alloc = InvigilatorAllocation(
            exam_id=eid,
            invigilator_id=inv.id,
            room_id=room.id
        )
        db.add(alloc)

    db.commit()
    return DutyAssignResult(
        message=f"{inv.name} manually assigned to Room {room.room_number} ({room.block}).",
        status="SUCCESS",
        invigilator_id=inv.id,
        invigilator_name=inv.name,
        room_id=room.id,
        room_number=room.room_number,
        assignments=[{"invigilator_id": inv.id, "room_id": room.id}]
    )

@router.get("/my-duties", response_model=List[DutyAssignmentResponse])
def get_my_duties(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["INVIGILATOR"]))
):
    """
    Fetch examination duties assigned to the authenticated faculty invigilator.
    Bulk-fetches related models and pre-aggregates student/attendance counts in SQL.
    Restricted to INVIGILATOR role.
    """
    from collections import defaultdict
    from sqlalchemy import func, or_, and_

    inv = db.execute(select(Invigilator).where(Invigilator.user_id == current_user.id)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invigilator profile not linked to user account.")

    allocations = db.execute(
        select(InvigilatorAllocation).where(InvigilatorAllocation.invigilator_id == inv.id)
    ).scalars().all()
    if not allocations:
        return []

    # Bulk fetch referenced exams and rooms
    exam_ids = list({a.exam_id for a in allocations})
    room_ids = list({a.room_id for a in allocations})
    exams_map = {e.id: e for e in db.execute(select(Exam).where(Exam.id.in_(exam_ids))).scalars().all()}
    rooms_map = {r.id: r for r in db.execute(select(Room).where(Room.id.in_(room_ids))).scalars().all()}

    # Group concurrent sessions
    sessions = list({(e.exam_date, e.session) for e in exams_map.values()})
    session_conditions = [and_(Exam.exam_date == d, Exam.session == s) for d, s in sessions]
    session_exams_list = db.execute(select(Exam).where(or_(*session_conditions))).scalars().all() if session_conditions else []
    session_exams_by_key = defaultdict(list)
    for se in session_exams_list:
        session_exams_by_key[(se.exam_date, se.session)].append(se)

    all_concurrent_exam_ids = [e.id for e in session_exams_list]

    # Pre-aggregate allocation counts per (room_id, exam_id)
    alloc_counts = db.execute(
        select(StudentAllocation.room_id, StudentAllocation.exam_id, func.count(StudentAllocation.id))
        .where(
            StudentAllocation.room_id.in_(room_ids),
            StudentAllocation.exam_id.in_(all_concurrent_exam_ids)
        )
        .group_by(StudentAllocation.room_id, StudentAllocation.exam_id)
    ).all() if all_concurrent_exam_ids else []
    alloc_count_map = {(row[0], row[1]): row[2] for row in alloc_counts}

    # Pre-aggregate attendance counts per (room_id, exam_id, status)
    att_counts = db.execute(
        select(AttendanceRecord.room_id, AttendanceRecord.exam_id, AttendanceRecord.status, func.count(AttendanceRecord.id))
        .where(
            AttendanceRecord.room_id.in_(room_ids),
            AttendanceRecord.exam_id.in_(all_concurrent_exam_ids)
        )
        .group_by(AttendanceRecord.room_id, AttendanceRecord.exam_id, AttendanceRecord.status)
    ).all() if all_concurrent_exam_ids else []
    att_count_map = {(row[0], row[1], row[2]): row[3] for row in att_counts}

    seen_room_exams = set()
    duties = []
    for alloc in allocations:
        exam = exams_map.get(alloc.exam_id)
        room = rooms_map.get(alloc.room_id)
        if not exam or not room:
            continue

        room_key = (room.id, exam.exam_date, exam.session)
        if room_key in seen_room_exams:
            continue
        seen_room_exams.add(room_key)

        session_exams = session_exams_by_key.get((exam.exam_date, exam.session), [exam])
        concurrent_eids = [e.id for e in session_exams]

        # Calculate totals from pre-aggregated dictionary maps
        total_count = sum(alloc_count_map.get((room.id, eid), 0) for eid in concurrent_eids)
        present_count = sum(att_count_map.get((room.id, eid, "PRESENT"), 0) for eid in concurrent_eids)
        absent_count = sum(att_count_map.get((room.id, eid, "ABSENT"), 0) for eid in concurrent_eids)

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
                present_count=present_count,
                absent_count=absent_count
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

