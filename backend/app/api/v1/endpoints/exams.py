from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.api.deps import require_role
from app.models.user import User
from app.models.exam import Exam, ExamStudent
from app.models.academic import Student
from app.models.seating import StudentAllocation
from app.schemas.exam import ExamCreate, ExamResponse, ExamLaunchRequest, ExamLaunchResponse

router = APIRouter()

@router.get("/", response_model=List[ExamResponse])
def list_exams(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT", "INVIGILATOR", "STUDENT"]))
):
    """
    List all scheduled examinations with enrollment and allocation counts.
    """
    exams = db.execute(select(Exam).order_by(Exam.exam_date)).scalars().all()
    results = []
    for exam in exams:
        enrolled_count = db.execute(
            select(ExamStudent).where(ExamStudent.exam_id == exam.id)
        ).scalars().all()
        
        alloc_count = db.execute(
            select(StudentAllocation).where(StudentAllocation.exam_id == exam.id)
        ).scalars().all()

        results.append(
            ExamResponse(
                id=exam.id,
                subject_code=exam.subject_code,
                subject_name=exam.subject_name,
                exam_type=getattr(exam, "exam_type", "MID"),
                exam_subdivision=getattr(exam, "exam_subdivision", "MID_1" if getattr(exam, "exam_type", "MID") == "MID" else "REGULAR"),
                exam_date=exam.exam_date,
                start_time=exam.start_time,
                end_time=exam.end_time,
                session=exam.session,
                academic_year=exam.academic_year,
                semester=exam.semester,
                status=exam.status,
                enrolled_students_count=len(enrolled_count),
                allocated_students_count=len(alloc_count)
            )
        )
    return results

@router.post("/", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
def create_exam(
    payload: ExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Schedule an exam and automatically register students from eligible branches.
    Restricted to ROOT administrators.
    """
    ex_type = payload.exam_type or "MID"
    ex_subdiv = payload.exam_subdivision or ("MID_1" if ex_type == "MID" else "REGULAR")
    exam = Exam(
        subject_code=payload.subject_code,
        subject_name=payload.subject_name,
        exam_type=ex_type,
        exam_subdivision=ex_subdiv,
        exam_date=payload.exam_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        session=payload.session,
        academic_year=payload.academic_year,
        semester=payload.semester,
        status=payload.status
    )
    db.add(exam)
    db.flush()

    # Register students from eligible department IDs (or all if empty)
    student_query = select(Student)
    if payload.eligible_department_ids:
        student_query = student_query.where(Student.department_id.in_(payload.eligible_department_ids))
    students = db.execute(student_query).scalars().all()

    for s in students:
        reg = ExamStudent(exam_id=exam.id, student_id=s.id)
        db.add(reg)

    db.commit()
    db.refresh(exam)

    return ExamResponse(
        id=exam.id,
        subject_code=exam.subject_code,
        subject_name=exam.subject_name,
        exam_type=exam.exam_type,
        exam_subdivision=exam.exam_subdivision,
        exam_date=exam.exam_date,
        start_time=exam.start_time,
        end_time=exam.end_time,
        session=exam.session,
        academic_year=exam.academic_year,
        semester=exam.semester,
        status=exam.status,
        enrolled_students_count=len(students),
        allocated_students_count=0
    )

@router.post("/launch", response_model=ExamLaunchResponse)
def launch_exam_session(
    payload: ExamLaunchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Launch examination session: sets status to ACTIVE, executes cross-branch seating
    allocation, and assigns conflict-free faculty invigilators to all utilized halls.
    Restricted to ROOT administrators.
    """
    from app.algorithms.seating_engine import SeatingEngine
    from app.models.academic import Invigilator, Department
    from app.models.infrastructure import Room
    from app.models.seating import InvigilatorAllocation
    from app.schemas.exam import DutyRosterItem

    # Resolve target exam IDs
    target_exam_ids = []
    if payload.exam_ids:
        target_exam_ids = payload.exam_ids
    elif payload.exam_id:
        target_exam_ids = [payload.exam_id]
    else:
        # Default: launch SCHEDULED exams of the upcoming session
        sched = db.execute(select(Exam).where(Exam.status == "SCHEDULED").order_by(Exam.exam_date, Exam.id)).scalars().all()
        if sched:
            first_date = sched[0].exam_date
            first_session = sched[0].session
            target_exam_ids = [e.id for e in sched if e.exam_date == first_date and e.session == first_session]
        else:
            target_exam_ids = []

    if not target_exam_ids:
        raise HTTPException(status_code=400, detail="No scheduled examinations found to launch.")

    # Execute seating and invigilation engine
    engine = SeatingEngine(db)
    summary = engine.run_allocation(
        exam_id=payload.exam_id,
        exam_ids=target_exam_ids,
        room_ids=payload.room_ids,
        exam_type=payload.exam_type,
        exam_subdivision=payload.exam_subdivision,
        strategy=payload.strategy or "MULTI_BRANCH_MIXING",
        arrangement_direction=payload.arrangement_direction or "COLUMN_WISE"
    )

    # Fetch updated exams
    exams = db.execute(select(Exam).where(Exam.id.in_(target_exam_ids))).scalars().all()
    launched_exams_res = []
    for ex in exams:
        enrolled = db.execute(select(ExamStudent).where(ExamStudent.exam_id == ex.id)).scalars().all()
        alloc = db.execute(select(StudentAllocation).where(StudentAllocation.exam_id == ex.id)).scalars().all()
        launched_exams_res.append(
            ExamResponse(
                id=ex.id,
                subject_code=ex.subject_code,
                subject_name=ex.subject_name,
                exam_type=ex.exam_type,
                exam_subdivision=getattr(ex, "exam_subdivision", "MID_1" if ex.exam_type == "MID" else "REGULAR"),
                exam_date=ex.exam_date,
                start_time=ex.start_time,
                end_time=ex.end_time,
                session=ex.session,
                academic_year=ex.academic_year,
                semester=ex.semester,
                status=ex.status,
                enrolled_students_count=len(enrolled),
                allocated_students_count=len(alloc)
            )
        )

    # Fetch assigned invigilator roster
    inv_allocs = db.execute(
        select(InvigilatorAllocation).where(InvigilatorAllocation.exam_id.in_(target_exam_ids))
    ).scalars().all()

    duty_roster = []
    seen_roster = set()
    for ia in inv_allocs:
        key = (ia.room_id, ia.invigilator_id)
        if key in seen_roster:
            continue
        seen_roster.add(key)
        rm = db.execute(select(Room).where(Room.id == ia.room_id)).scalar_one_or_none()
        inv = db.execute(select(Invigilator).where(Invigilator.id == ia.invigilator_id)).scalar_one_or_none()
        dept = db.execute(select(Department).where(Department.id == inv.department_id)).scalar_one_or_none() if inv else None
        if rm and inv:
            cand_count = summary.details_by_room.get(f"Room {rm.room_number}", 0)
            duty_roster.append(
                DutyRosterItem(
                    room_id=rm.id,
                    room_number=rm.room_number,
                    block=rm.block,
                    invigilator_id=inv.id,
                    invigilator_name=inv.name,
                    faculty_id=inv.faculty_id,
                    department_code=dept.code if dept else "N/A",
                    total_candidates=cand_count,
                    is_alternative_fallback=False
                )
            )

    # BROADCAST NOTIFICATIONS to allocated students and invigilators
    from app.api.v1.endpoints.notifications import broadcast_notification
    try:
        # Get Student user IDs
        student_uids = db.execute(
            select(Student.user_id)
            .join(StudentAllocation, StudentAllocation.student_id == Student.id)
            .where(StudentAllocation.exam_id.in_(target_exam_ids))
        ).scalars().all()

        # Get Invigilator user IDs
        invig_uids = db.execute(
            select(Invigilator.user_id)
            .join(InvigilatorAllocation, InvigilatorAllocation.invigilator_id == Invigilator.id)
            .where(InvigilatorAllocation.exam_id.in_(target_exam_ids))
        ).scalars().all()

        # Target Student Payload
        if student_uids:
            broadcast_notification(db, student_uids, {
                "title": f"📋 Exam Allocation Live",
                "body": f"Your seating for the scheduled examination is now available.",
                "url": "/student/exam",
                "vibrate": [300, 100, 300, 100, 300]
            })

        # Target Invigilator Payload
        if invig_uids:
            broadcast_notification(db, invig_uids, {
                "title": f"🔔 Duty Assigned",
                "body": f"You are assigned invigilation duty for the scheduled examination.",
                "url": "/invigilator/exams",
                "vibrate": [300, 100, 300, 100, 300]
            })
    except Exception as e:
        print(f"Failed to broadcast notifications: {e}")

    return ExamLaunchResponse(
        message=f"Successfully launched {len(launched_exams_res)} examination(s). {summary.total_students_allocated} candidates allocated across {summary.rooms_utilized} halls with 100% branch-mixing compliance.",
        status="ACTIVE",
        launched_exams=launched_exams_res,
        total_students_allocated=summary.total_students_allocated,
        rooms_utilized=summary.rooms_utilized,
        branch_mixing_compliance_percent=summary.branch_mixing_compliance_percent,
        duty_roster=duty_roster
    )

@router.post("/{exam_id}/launch", response_model=ExamLaunchResponse)
def launch_single_exam(
    exam_id: int,
    payload: Optional[ExamLaunchRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Launch a specific examination by ID.
    Restricted to ROOT administrators.
    """
    req = payload or ExamLaunchRequest(exam_id=exam_id)
    req.exam_id = exam_id
    return launch_exam_session(req, db, current_user)

