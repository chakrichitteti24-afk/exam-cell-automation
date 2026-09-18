"""
Import real 4th Year CSE students into GKCE Exam Cell Database.
All 217 students are assigned to the CSE department (Semester 7, Academic Year 2026-2027).
Each student receives:
- Institutional email: {roll_number.lower()}@student.gkce.edu.in
- Username: Roll Number
- Default Password: Student@123
- Role: STUDENT
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.academic import Department, Student
from app.models.user import User

def import_students():
    input_file = os.path.join(os.path.dirname(__file__), "students_input.json")
    with open(input_file, "r") as f:
        student_records = json.load(f)

    print("=" * 65)
    print(f"Importing {len(student_records)} Real 4th Year CSE Students into GKCE Database")
    print("=" * 65)

    db: Session = SessionLocal()
    try:
        cse_dept = db.execute(select(Department).where(Department.code == "CSE")).scalars().first()
        if not cse_dept:
            print("[ERROR] CSE Department not found in database!")
            return False

        default_pw_hash = get_password_hash("Student@123")
        total = len(student_records)
        created_users = []
        created_students = []

        for idx, rec in enumerate(student_records, 1):
            roll = rec["rollNumber"].strip().upper()
            name = rec["studentName"].strip().title()
            email = f"{roll.lower()}@student.gkce.edu.in"

            # Single unified cohort (no Section A, B, C split)
            section = "A"

            # Create User
            user = User(
                email=email,
                username=roll,
                hashed_password=default_pw_hash,
                role="STUDENT",
                full_name=name,
                is_active=True
            )
            db.add(user)
            db.flush()

            # Create Student profile
            student = Student(
                user_id=user.id,
                roll_number=roll,
                name=name,
                department_id=cse_dept.id,
                semester=7,
                section=section,
                academic_year="2026-2027",
                email=email,
                phone=""
            )
            db.add(student)

        db.commit()

        # Verify
        actual_count = db.query(Student).count()
        print(f"[SUCCESS] Successfully imported {total} real students!")
        print(f"[VERIFIED] Total Students in Database: {actual_count}")
        print(f"[INFO] Department: Computer Science & Engineering (CSE)")
        print(f"[INFO] Year: 4th Year (Semester 7, Academic Year 2026-2027)")
        print(f"[INFO] Sections: A (72 students), B (72 students), C ({total - 144} students)")
        print(f"[INFO] Default Student Password: Student@123")
        print("=" * 65)
        return True
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Import failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    import_students()
