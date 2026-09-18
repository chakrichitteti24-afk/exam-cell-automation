from typing import List, Optional
import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select, or_
from app.db.session import get_db
from app.api.deps import require_role
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from app.models.academic import Student, Department
from app.schemas.student import StudentCreate, StudentResponse, StudentImportSummary

router = APIRouter()

@router.get("/", response_model=List[StudentResponse])
def list_students(
    department_id: Optional[int] = None,
    semester: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    List all students with optional filters for branch, semester, and search.
    Restricted to ROOT administrators.
    """
    stmt = select(Student)
    if department_id:
        stmt = stmt.where(Student.department_id == department_id)
    if semester:
        stmt = stmt.where(Student.semester == semester)
    if search:
        search_term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Student.roll_number.ilike(search_term),
                Student.name.ilike(search_term),
                Student.email.ilike(search_term)
            )
        )
    stmt = stmt.offset(skip).limit(limit)
    students = db.execute(stmt).scalars().all()

    # Pre-fetch all departments to avoid N+1 query over the network
    all_depts = db.execute(select(Department)).scalars().all()
    dept_map = {d.id: d.code for d in all_depts}

    # Enrich with department code
    results = []
    for s in students:
        results.append(
            StudentResponse(
                id=s.id,
                roll_number=s.roll_number,
                name=s.name,
                department_id=s.department_id,
                department_code=dept_map.get(s.department_id),
                semester=s.semester,
                section=s.section,
                academic_year=s.academic_year,
                email=s.email,
                phone=s.phone,
                user_id=s.user_id
            )
        )
    return results

@router.post("/", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Add an individual student and generate credentials.
    Restricted to ROOT administrators.
    """
    existing = db.execute(select(Student).where(Student.roll_number == payload.roll_number)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"Student with roll number '{payload.roll_number}' already exists.")

    raw_password = payload.password if payload.password else "gkce@1234"
    hashed = get_password_hash(raw_password)

    # Check if user email or username already exists
    existing_user_email = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if existing_user_email:
        raise HTTPException(status_code=400, detail=f"Email '{payload.email}' is already in use by another account.")
        
    existing_username = db.execute(select(User).where(User.username == payload.roll_number)).scalar_one_or_none()
    if existing_username:
        raise HTTPException(status_code=400, detail=f"Username '{payload.roll_number}' is already in use by another account.")

    # Create User account
    user = User(
        email=payload.email,
        username=payload.roll_number,
        hashed_password=hashed,
        role="STUDENT",
        full_name=payload.name
    )
    db.add(user)
    db.flush()

    student = Student(
        user_id=user.id,
        roll_number=payload.roll_number,
        name=payload.name,
        department_id=payload.department_id,
        semester=payload.semester,
        section=payload.section,
        academic_year=payload.academic_year,
        email=payload.email,
        phone=payload.phone or "+91 98765 43210"
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    dept = db.execute(select(Department).where(Department.id == student.department_id)).scalar_one_or_none()
    return StudentResponse(
        id=student.id,
        roll_number=student.roll_number,
        name=student.name,
        department_id=student.department_id,
        department_code=dept.code if dept else None,
        semester=student.semester,
        section=student.section,
        academic_year=student.academic_year,
        email=student.email,
        phone=student.phone,
        user_id=student.user_id
    )

@router.post("/import-csv", response_model=StudentImportSummary)
async def import_students_from_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Bulk import students from CSV or Excel file.
    Returns imported count, skipped count, errors, and temporary credentials.
    Restricted to ROOT administrators.
    """
    filename = file.filename.lower() if file.filename else ""
    if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only .csv, .xlsx, and .xls files are supported."
        )

    # Enforce maximum upload size to mitigate memory exhaustion DoS
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    contents = await file.read(max_bytes + 1)
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
        )
    try:
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to parse tabular file data. Please ensure it is a valid CSV or Excel file."
        )

    total_records = len(df)
    imported = 0
    skipped = 0
    errors = []
    credentials = []

    # Map department codes
    departments = db.execute(select(Department)).scalars().all()
    dept_map = {d.code.upper(): d.id for d in departments}

    # Pre-extract candidate roll numbers and emails to bulk fetch existing records
    candidate_rolls = set()
    candidate_emails = set()
    for _, row in df.iterrows():
        r = str(row.get("roll_number", "")).strip().upper()
        em = str(row.get("email", f"{r.lower()}@student.gkce.edu.in")).strip()
        if r:
            candidate_rolls.add(r)
        if em:
            candidate_emails.add(em)

    # Bulk fetch existing records in 3 fast indexed queries
    existing_rolls = set(
        db.execute(select(Student.roll_number).where(Student.roll_number.in_(candidate_rolls))).scalars().all()
    ) if candidate_rolls else set()

    existing_user_names = set(
        db.execute(select(User.username).where(User.username.in_(candidate_rolls))).scalars().all()
    ) if candidate_rolls else set()

    existing_user_emails = set(
        db.execute(select(User.email).where(User.email.in_(candidate_emails))).scalars().all()
    ) if candidate_emails else set()

    seen_rolls = set()
    seen_emails = set()

    import secrets

    for idx, row in df.iterrows():
        try:
            roll = str(row.get("roll_number", "")).strip().upper()
            name = str(row.get("name", "")).strip()
            dept_code = str(row.get("department", "CSE")).strip().upper()
            sem = int(row.get("semester", 5))
            sec = str(row.get("section", "A")).strip()
            email_val = str(row.get("email", f"{roll.lower()}@gkce.edu.in")).strip()
            acad_year = str(row.get("academic_year", "2026-2027")).strip()

            if not roll or not name:
                skipped += 1
                continue

            # Skip if roll number already exists in DB or current import batch
            if roll in existing_rolls or roll in seen_rolls:
                skipped += 1
                errors.append(f"Row {idx+2}: Roll number '{roll}' already exists — skipped.")
                continue

            # Skip if email or username already exists in users table or current batch
            if email_val in existing_user_emails or email_val in seen_emails:
                skipped += 1
                errors.append(f"Row {idx+2}: Email '{email_val}' already registered — skipped.")
                continue

            if roll in existing_user_names:
                skipped += 1
                errors.append(f"Row {idx+2}: Username '{roll}' already registered — skipped.")
                continue

            dept_id = dept_map.get(dept_code)
            if not dept_id:
                dept_id = dept_map.get("CSE", 1)

            temp_pw = "gkce@1234"

            # Create User
            user = User(
                email=email_val,
                username=roll,
                hashed_password=get_password_hash(temp_pw),
                role="STUDENT",
                full_name=name
            )
            db.add(user)
            db.flush()

            student = Student(
                user_id=user.id,
                roll_number=roll,
                name=name,
                department_id=dept_id,
                semester=sem,
                section=sec,
                academic_year=acad_year,
                email=email_val
            )
            db.add(student)
            seen_rolls.add(roll)
            seen_emails.add(email_val)
            credentials.append({"roll_number": roll, "email": email_val, "temp_password": temp_pw})
            imported += 1
        except Exception as row_err:
            errors.append(f"Row {idx+2}: {str(row_err)}")
            skipped += 1

    db.commit()
    return StudentImportSummary(
        total_records=total_records,
        imported_count=imported,
        skipped_count=skipped,
        errors=errors[:20],
        credentials=credentials
    )

@router.delete("/{student_id}", status_code=status.HTTP_200_OK)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Permanently remove a student record and their linked user account.
    Restricted to ROOT administrators.
    """
    from sqlalchemy import delete as sql_delete
    from app.models.seating import StudentAllocation, AttendanceRecord
    from app.models.exam import ExamStudent
    from app.models.push_subscription import PushSubscription

    student = db.execute(select(Student).where(Student.id == student_id)).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student with ID {student_id} not found.")

    # 1. Clean up attendance records
    db.execute(sql_delete(AttendanceRecord).where(AttendanceRecord.student_id == student.id))
    
    # 2. Clean up allocations
    db.execute(sql_delete(StudentAllocation).where(StudentAllocation.student_id == student.id))

    # 3. Clean up exam registrations
    db.execute(sql_delete(ExamStudent).where(ExamStudent.student_id == student.id))

    # Save user_id to delete after the student record is removed
    user_id_to_delete = student.user_id

    # 4. Delete student (child record referencing User)
    db.delete(student)
    
    # 5. Remove linked user account and related push subscriptions
    if user_id_to_delete:
        db.execute(sql_delete(PushSubscription).where(PushSubscription.user_id == user_id_to_delete))
        user = db.execute(select(User).where(User.id == user_id_to_delete)).scalar_one_or_none()
        if user:
            db.delete(user)

    db.commit()

    return {"message": "Student and all associated records permanently deleted."}
