from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.base import Base
from app.db.session import engine
from app.core.security import get_password_hash
from app.core.config import settings
import app.models
from app.models.user import User
from app.models.academic import Department

STANDARD_DEPARTMENTS = [
    ("CSE",   "Computer Science & Engineering"),
    ("ECE",   "Electronics & Communication Engineering"),
    ("EEE",   "Electrical & Electronics Engineering"),
    ("MECH",  "Mechanical Engineering"),
    ("CIVIL", "Civil Engineering"),
]

def create_admin_user(
    db: Session,
    email: str,
    password: str,
    username: str = "admin",
    full_name: str = "Controller of Examinations"
) -> User:
    """
    Safely create or update an administrator account without hardcoding credentials in source code.
    """
    existing_user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing_user:
        existing_user.hashed_password = get_password_hash(password)
        existing_user.role = "ROOT"
        existing_user.full_name = full_name
        existing_user.is_active = True
        db.commit()
        db.refresh(existing_user)
        return existing_user

    admin_user = User(
        email=email,
        username=username,
        hashed_password=get_password_hash(password),
        role="ROOT",
        full_name=full_name,
        is_active=True
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    return admin_user

def init_db(db: Session, force: bool = False) -> None:
    """
    Initialize the GKCE Exam Cell database schema and standard institutional departments.
    Zero fake data (no mock students, no mock exams, no mock invigilators) is seeded into production.
    """
    # 1. Create tables if they do not exist
    Base.metadata.create_all(bind=engine)

    # 2. Ensure standard institutional departments exist
    for code, name in STANDARD_DEPARTMENTS:
        existing_dept = db.execute(select(Department).where(Department.code == code)).scalar_one_or_none()
        if not existing_dept:
            dept = Department(code=code, name=name)
            db.add(dept)
    db.commit()

    # 3. Optional: Bootstrap administrator from environment variables if provided
    if settings.INITIAL_ADMIN_EMAIL and settings.INITIAL_ADMIN_PASSWORD:
        create_admin_user(
            db=db,
            email=settings.INITIAL_ADMIN_EMAIL,
            password=settings.INITIAL_ADMIN_PASSWORD,
            username="admin",
            full_name="Controller of Examinations"
        )
        print(f"[SECURITY] Bootstrap administrator configured for {settings.INITIAL_ADMIN_EMAIL}.")
