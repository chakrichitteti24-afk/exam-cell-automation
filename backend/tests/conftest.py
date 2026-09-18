import pytest
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.core.security import get_password_hash
from app.models.user import User
from app.models.academic import Department, Student, Invigilator
from app.models.infrastructure import Room, Bench, Seat
from app.models.exam import Exam, ExamStudent
from app.models.seating import StudentAllocation, InvigilatorAllocation, AttendanceRecord
from app.models.push_subscription import PushSubscription

from app.core.config import settings
from seed import seed_demo_data
from app.algorithms.seating_engine import SeatingEngine

@pytest.fixture(scope="session", autouse=True)
def isolated_test_suite_data():
    """
    Session-wide fixture that initializes required demonstration data if missing,
    clears transient test allocations/attendance, and ensures the test suite
    executes rapidly and reliably against the Neon database.
    """
    db: Session = SessionLocal()
    try:
        # 1. Ensure schema tables exist
        Base.metadata.create_all(bind=engine)

        # 2. Clear transient dynamic data
        db.execute(delete(PushSubscription))
        db.execute(delete(StudentAllocation))
        db.execute(delete(InvigilatorAllocation))
        db.execute(delete(AttendanceRecord))

        # 3. Only auto-seed test fixtures if using a local SQLite test database
        st_count = db.query(Student).count()
        rm_count = db.query(Room).count()
        inv_count = db.query(Invigilator).count()
        ex_count = db.query(Exam).count()

        is_sqlite = "sqlite" in settings.DATABASE_URL.lower()
        if is_sqlite and (st_count < 50 or rm_count < 4 or inv_count < 4 or ex_count < 4):
            seed_demo_data(db)
        elif st_count >= 1 and ex_count >= 1:
            # Reset exams to SCHEDULED
            from sqlalchemy import update
            db.execute(update(Exam).values(status="SCHEDULED"))
            
            # Ensure standard passwords for test accounts
            admin_pw = get_password_hash("Admin@123")
            fac_pw = get_password_hash("Faculty@123")
            st_pw = get_password_hash("Student@123")
            
            admin_u = db.execute(select(User).where(User.email == "admin@gkce.edu.in")).scalar_one_or_none()
            if admin_u:
                admin_u.hashed_password = admin_pw
            fac_u = db.execute(select(User).where(User.email == "prof.sharma@gkce.edu.in")).scalar_one_or_none()
            if fac_u:
                fac_u.hashed_password = fac_pw
            st_u = db.execute(select(User).where(User.username == "23CS042")).scalar_one_or_none()
            if st_u:
                st_u.hashed_password = st_pw
            db.commit()
    finally:
        db.close()

    # Yield control to the test suite
    yield

    # Clean up: restore database to standard demonstration state with active seating allocation
    cleanup_db: Session = SessionLocal()
    try:
        cleanup_db.execute(delete(PushSubscription))
        cleanup_db.execute(delete(StudentAllocation))
        cleanup_db.execute(delete(InvigilatorAllocation))
        cleanup_db.execute(delete(AttendanceRecord))
        cleanup_db.commit()

        first_exam = cleanup_db.execute(select(Exam).order_by(Exam.id)).scalars().first()
        if first_exam:
            engine_inst = SeatingEngine(cleanup_db)
            engine_inst.run_allocation(exam_id=first_exam.id)
        print("[TEST SUITE TEARDOWN] Database restored to standard demonstration state with active allocation.")
    except Exception as e:
        print(f"[TEST SUITE TEARDOWN ERROR] {e}")
    finally:
        cleanup_db.close()
