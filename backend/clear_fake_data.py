"""
Purge all demonstration / fake data from GKCE Exam Cell Database.
Preserves:
- Root Administrator account (admin@gkce.edu.in)
- Institutional academic departments (CSE, ECE, EEE, MECH, CIVIL)
- Database schema tables
"""
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import User
from app.models.academic import Department, Student, Invigilator
from app.models.infrastructure import Room, Bench, Seat
from app.models.exam import Exam, ExamStudent
from app.models.seating import StudentAllocation, InvigilatorAllocation, AttendanceRecord
from app.models.push_subscription import PushSubscription
from app.core.security import get_password_hash

def clear_all_fake_data(db: Session):
    print("=" * 60)
    print("GKCE Exam Cell: Purging Fake / Demonstration Data")
    print("=" * 60)

    try:
        # 1. Delete transient seating allocations & attendance
        del_attend = db.execute(delete(AttendanceRecord)).rowcount
        del_push = db.execute(delete(PushSubscription)).rowcount
        del_st_alloc = db.execute(delete(StudentAllocation)).rowcount
        del_inv_alloc = db.execute(delete(InvigilatorAllocation)).rowcount
        print(f"[CLEARED] Seating allocations: {del_st_alloc} student, {del_inv_alloc} invigilator")
        print(f"[CLEARED] Attendance records: {del_attend}, Push subscriptions: {del_push}")

        # 2. Delete exam student registrations & exams
        del_ex_st = db.execute(delete(ExamStudent)).rowcount
        del_exams = db.execute(delete(Exam)).rowcount
        print(f"[CLEARED] Exams: {del_exams} exams, {del_ex_st} student exam registrations")

        # 3. Delete seats, benches, and rooms
        del_seats = db.execute(delete(Seat)).rowcount
        del_benches = db.execute(delete(Bench)).rowcount
        del_rooms = db.execute(delete(Room)).rowcount
        print(f"[CLEARED] Infrastructure: {del_rooms} rooms, {del_benches} benches, {del_seats} seats")

        # 4. Delete students and invigilators
        del_students = db.execute(delete(Student)).rowcount
        del_invigilators = db.execute(delete(Invigilator)).rowcount
        print(f"[CLEARED] Academic profiles: {del_students} students, {del_invigilators} invigilators")

        # 5. Delete non-admin user accounts (keep ROOT administrator)
        del_users = db.execute(delete(User).where(User.role != "ROOT")).rowcount
        print(f"[CLEARED] User credentials: {del_users} student/faculty accounts")

        # 6. Verify or ensure Root Administrator exists
        admin = db.execute(select(User).where(User.role == "ROOT")).scalars().first()
        if not admin:
            admin_pw = get_password_hash("Admin@123")
            admin = User(
                email="admin@gkce.edu.in",
                username="admin",
                hashed_password=admin_pw,
                role="ROOT",
                full_name="Controller of Examinations",
                is_active=True
            )
            db.add(admin)
            print("[PRESERVED] Created fresh Root Administrator: admin@gkce.edu.in")
        else:
            print(f"[PRESERVED] Root Administrator verified: {admin.email} (ID: {admin.id})")

        # 7. Verify standard departments
        depts = db.execute(select(Department)).scalars().all()
        dept_codes = [d.code for d in depts]
        print(f"[PRESERVED] Standard Departments ({len(depts)}): {', '.join(dept_codes)}")

        db.commit()
        print("=" * 60)
        print("PURGE COMPLETE: All fake data successfully removed!")
        print("Database is clean and ready for real GKCE institutional data.")
        print("=" * 60)
        return True
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to purge data: {e}")
        raise e

if __name__ == "__main__":
    db = SessionLocal()
    try:
        clear_all_fake_data(db)
    finally:
        db.close()
