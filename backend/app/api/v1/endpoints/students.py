from typing import List, Optional
import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select, or_
from app.db.session import get_db
from app.api.deps import require_role
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

    # Enrich with department code
    results = []
    for s in students:
        dept = db.execute(select(Department).where(Department.id == s.department_id)).scalar_one_or_none()
        results.append(
            StudentResponse(
                id=s.id,
                roll_number=s.roll_number,
                name=s.name,
                department_id=s.department_id,
                department_code=dept.code if dept else None,
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

    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required when creating a student account.")
    hashed = get_password_hash(payload.password)

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
    contents = await file.read()
    filename = file.filename.lower() if file.filename else ""
    
    try:
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    total_records = len(df)
    imported = 0
    skipped = 0
    errors = []
    credentials = []

    # Map department codes
    departments = db.execute(select(Department)).scalars().all()
    dept_map = {d.code.upper(): d.id for d in departments}

    for idx, row in df.iterrows():
        try:
            roll = str(row.get("roll_number", "")).strip().upper()
            name = str(row.get("name", "")).strip()
            dept_code = str(row.get("department", "CSE")).strip().upper()
            sem = int(row.get("semester", 5))
            sec = str(row.get("section", "A")).strip()
            email_val = str(row.get("email", f"{roll.lower()}@student.gkce.edu.in")).strip()
            acad_year = str(row.get("academic_year", "2026-2027")).strip()

            if not roll or not name:
                skipped += 1
                continue

            # Skip if roll number already exists
            exists = db.execute(select(Student).where(Student.roll_number == roll)).scalar_one_or_none()
            if exists:
                skipped += 1
                errors.append(f"Row {idx+2}: Roll number '{roll}' already exists — skipped.")
                continue

            # Skip if email already exists in users
            email_exists = db.execute(select(User).where(User.email == email_val)).scalar_one_or_none()
            if email_exists:
                skipped += 1
                errors.append(f"Row {idx+2}: Email '{email_val}' already registered — skipped.")
                continue

            dept_id = dept_map.get(dept_code)
            if not dept_id:
                dept_id = dept_map.get("CSE", 1)

            import secrets
            temp_pw = secrets.token_urlsafe(12)

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
    student = db.execute(select(Student).where(Student.id == student_id)).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student with ID {student_id} not found.")

    # Remove linked user account
    if student.user_id:
        user = db.execute(select(User).where(User.id == student.user_id)).scalar_one_or_none()
        if user:
            db.delete(user)

    db.delete(student)
    db.commit()
    return {"message": f"Student '{student.name}' ({student.roll_number}) and their user account have been permanently removed."}
