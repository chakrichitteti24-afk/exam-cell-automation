"""
Bulk import 247 Real 3rd Year CSE students into GKCE Exam Cell Database.
Semester: 5 (3rd Year, Academic Year 2026-2027)
Department: CSE (Department ID 1)
"""
import sys
import os
import json
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.academic import Department, Student
from app.models.user import User

def import_3rd_year():
    input_file = os.path.join(os.path.dirname(__file__), "3rd_year_students.json")
    with open(input_file, "r", encoding="utf-8") as f:
        records = json.load(f)

    print("=" * 65)
    print(f"Bulk Importing {len(records)} Real 3rd Year CSE Students into GKCE Database")
    print("=" * 65)

    db: Session = SessionLocal()
    t0 = time.time()
    try:
        cse_dept = db.execute(select(Department).where(Department.code == "CSE")).scalars().first()
        if not cse_dept:
            print("[ERROR] CSE Department not found!")
            return False

        default_pw_hash = get_password_hash("Student@123")
        total = len(records)

        # 1. Prepare Users for bulk insertion
        users_to_add = []
        meta = []
        for idx, rec in enumerate(records, 1):
            roll = rec["rollNumber"].strip().upper()
            name = rec["studentName"].strip().title()
            email = f"{roll.lower()}@student.gkce.edu.in"
            
            u = User(
                email=email,
                username=roll,
                hashed_password=default_pw_hash,
                role="STUDENT",
                full_name=name,
                is_active=True
            )
            users_to_add.append(u)
            meta.append((idx, roll, name, email))

        # Bulk insert all users
        db.add_all(users_to_add)
        db.flush()
        print(f"[STAGE 1] Bulk inserted {len(users_to_add)} student user accounts.")

        # 2. Prepare Students linked to User IDs
        students_to_add = []
        for u, (idx, roll, name, email) in zip(users_to_add, meta):
            # Single unified cohort (no Section A, B, C split)
            sec = "A"

            st = Student(
                user_id=u.id,
                roll_number=roll,
                name=name,
                department_id=cse_dept.id,
                semester=5,
                section=sec,
                academic_year="2026-2027",
                email=email,
                phone=""
            )
            students_to_add.append(st)

        # Bulk insert all students
        db.add_all(students_to_add)
        db.commit()
        duration = round(time.time() - t0, 2)
        print(f"[STAGE 2] Bulk inserted {len(students_to_add)} student profiles in {duration}s.")

        # Verify final database counts
        total_students = db.query(Student).count()
        fourth_year_cnt = db.query(Student).filter(Student.semester == 7).count()
        third_year_cnt = db.query(Student).filter(Student.semester == 5).count()

        print("=" * 65)
        print("[SUCCESS] 3rd Year CSE Batch Imported Successfully!")
        print(f"  - 3rd Year CSE Students (Sem 5): {third_year_cnt}")
        print(f"  - 4th Year CSE Students (Sem 7): {fourth_year_cnt}")
        print(f"  - Total Students in GKCE Database: {total_students}")
        print(f"  - Section Distribution (3rd Year): Sec A (82), Sec B (82), Sec C ({total - 164})")
        print(f"  - Default Login Password: Student@123")
        print("=" * 65)
        return True

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Import failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    import_3rd_year()
