"""
Bulk import 84 Real 2nd Year MBA students into GKCE Exam Cell Database.
Semester: 3 (2nd Year MBA, Academic Year 2026-2027)
Department: MBA (Department code MBA)
Credentials: {roll.lower()}@gkce.edu.in / gkce@1234
Single unified cohort (no Section A and Section B split).
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

def import_2nd_year_mba():
    input_file = os.path.join(os.path.dirname(__file__), "2nd_year_mba_students.json")
    with open(input_file, "r", encoding="utf-8") as f:
        records = json.load(f)

    print("=" * 65)
    print(f"Bulk Importing {len(records)} Real 2nd Year MBA Students into GKCE Database")
    print("=" * 65)

    db: Session = SessionLocal()
    t0 = time.time()
    try:
        mba_dept = db.execute(select(Department).where(Department.code == "MBA")).scalars().first()
        if not mba_dept:
            print("[ERROR] MBA Department not found!")
            return False

        default_pw_hash = get_password_hash("gkce@1234")
        total = len(records)

        # 1. Prepare Users for bulk insertion
        users_to_add = []
        meta = []
        for idx, rec in enumerate(records, 1):
            roll = rec["rollNumber"].strip().upper()
            name = rec["studentName"].strip().title()
            email = f"{roll.lower()}@gkce.edu.in"
            
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
        # Single unified cohort: All 84 students saved without Section A / B split
        students_to_add = []
        for u, (idx, roll, name, email) in zip(users_to_add, meta):
            sec = "A"

            st = Student(
                user_id=u.id,
                roll_number=roll,
                name=name,
                department_id=mba_dept.id,
                semester=3,
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
        second_year_cse_cnt = db.query(Student).join(Department).filter(Department.code == "CSE", Student.semester == 3).count()
        first_year_mba_cnt = db.query(Student).filter(Student.department_id == mba_dept.id, Student.semester == 1).count()
        second_year_mba_cnt = db.query(Student).filter(Student.department_id == mba_dept.id, Student.semester == 3).count()
        total_users = db.query(User).count()

        print("=" * 65)
        print("[SUCCESS] 2nd Year MBA Batch Imported Successfully!")
        print(f"  - 4th Year CSE Students (Sem 7): {fourth_year_cnt}")
        print(f"  - 3rd Year CSE Students (Sem 5): {third_year_cnt}")
        print(f"  - 2nd Year CSE Students (Sem 3): {second_year_cse_cnt}")
        print(f"  - 1st Year MBA Students (Sem 1): {first_year_mba_cnt}")
        print(f"  - 2nd Year MBA Students (Sem 3): {second_year_mba_cnt}")
        print(f"  - Total Enrolled Students in DB: {total_students}")
        print(f"  - Total User Accounts in DB:     {total_users}")
        print("=" * 65)
        return True
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    import_2nd_year_mba()
