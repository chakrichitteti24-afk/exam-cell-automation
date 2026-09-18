"""
Setup Test Data for GKCE Exam Cell Automation System:
- Rooms 101, 102, 201, 202 with benches & seats
- Faculty Invigilator: prof.sharma@gkce.edu.in (Faculty@123)
- Sample Mid-1 Exams: CS301 (CSE) and MBA101 (MBA)
- Student registrations for CS301 & MBA101
- Seating Allocation for Room 101 & 102 with Invigilator duty assignment
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.academic import Department, Student, Invigilator
from app.models.infrastructure import Room, Bench, Seat
from app.models.exam import Exam, ExamStudent
from app.algorithms.seating_engine import SeatingEngine

def setup_test_environment():
    db: Session = SessionLocal()
    try:
        print("1. Checking Rooms...")
        existing_rooms = {r.room_number: r for r in db.execute(select(Room)).scalars().all()}
        rooms_config = [
            ("101", "Block A", "1st Floor"),
            ("102", "Block A", "1st Floor"),
            ("201", "Block B", "2nd Floor"),
            ("202", "Block B", "2nd Floor"),
        ]
        created_rooms = []
        for r_num, block, floor in rooms_config:
            if r_num not in existing_rooms:
                room = Room(
                    room_number=r_num,
                    block=block,
                    floor=floor,
                    total_benches=24,
                    seats_per_bench=2,
                    capacity=48,
                    status="AVAILABLE"
                )
                db.add(room)
                created_rooms.append((r_num, room))
            else:
                created_rooms.append((r_num, existing_rooms[r_num]))

        db.flush()

        for r_num, room in created_rooms:
            existing_benches = db.execute(select(Bench).where(Bench.room_id == room.id)).scalars().all()
            if not existing_benches:
                all_benches = []
                for b_num in range(1, 25):
                    col_idx = ((b_num - 1) % 4) + 1
                    row_idx = ((b_num - 1) // 4) + 1
                    bench = Bench(
                        room_id=room.id,
                        bench_number=b_num,
                        row_index=row_idx,
                        col_index=col_idx
                    )
                    all_benches.append(bench)
                db.add_all(all_benches)
                db.flush()

                all_seats = []
                for bench in all_benches:
                    all_seats.append(Seat(bench_id=bench.id, seat_number=1, seat_label="Seat 01"))
                    all_seats.append(Seat(bench_id=bench.id, seat_number=2, seat_label="Seat 02"))
                db.add_all(all_seats)
                db.flush()

        print("   Rooms & Benches verified/created.")

        print("2. Checking Faculty Invigilators...")
        fac_email = "prof.sharma@gkce.edu.in"
        fac_user = db.execute(select(User).where(User.email == fac_email)).scalar_one_or_none()
        cse_dept = db.execute(select(Department).where(Department.code == "CSE")).scalar_one()
        fac_pw = get_password_hash("Faculty@123")

        if not fac_user:
            fac_user = User(
                email=fac_email,
                username="FAC-CSE-001",
                hashed_password=fac_pw,
                role="INVIGILATOR",
                full_name="Dr. Ramesh Sharma",
                is_active=True
            )
            db.add(fac_user)
            db.flush()

            inv = Invigilator(
                user_id=fac_user.id,
                faculty_id="FAC-CSE-001",
                name="Dr. Ramesh Sharma",
                department_id=cse_dept.id,
                designation="Professor & Head",
                email=fac_email,
                phone="+91 98765 43210"
            )
            db.add(inv)
            db.flush()
        else:
            fac_user.hashed_password = fac_pw
            inv = db.execute(select(Invigilator).where(Invigilator.user_id == fac_user.id)).scalar_one_or_none()
            if not inv:
                inv = Invigilator(
                    user_id=fac_user.id,
                    faculty_id="FAC-CSE-001",
                    name="Dr. Ramesh Sharma",
                    department_id=cse_dept.id,
                    designation="Professor & Head",
                    email=fac_email,
                    phone="+91 98765 43210"
                )
                db.add(inv)
                db.flush()

        fac_email2 = "prof.varma@gkce.edu.in"
        fac_user2 = db.execute(select(User).where(User.email == fac_email2)).scalar_one_or_none()
        ece_dept = db.execute(select(Department).where(Department.code == "ECE")).scalar_one_or_none()
        dept_for_varma = ece_dept.id if ece_dept else cse_dept.id

        if not fac_user2:
            fac_user2 = User(
                email=fac_email2,
                username="FAC-ECE-002",
                hashed_password=fac_pw,
                role="INVIGILATOR",
                full_name="Prof. K. Varma",
                is_active=True
            )
            db.add(fac_user2)
            db.flush()

            inv2 = Invigilator(
                user_id=fac_user2.id,
                faculty_id="FAC-ECE-002",
                name="Prof. K. Varma",
                department_id=dept_for_varma,
                designation="Associate Professor",
                email=fac_email2,
                phone="+91 98765 43211"
            )
            db.add(inv2)
            db.flush()
        print("   Faculty Invigilators verified/created.")

        print("3. Checking Exams...")
        cs_exam = db.execute(select(Exam).where(Exam.subject_code == "CS301")).scalar_one_or_none()
        if not cs_exam:
            cs_exam = Exam(
                subject_code="CS301",
                subject_name="Data Structures & Algorithms (Mid-1)",
                exam_type="MID",
                exam_subdivision="MID_1",
                exam_date="2026-09-28",
                start_time="10:00 AM",
                end_time="01:00 PM",
                session="Morning (FN)",
                academic_year="2026-2027",
                semester=5,
                status="SCHEDULED"
            )
            db.add(cs_exam)
            db.flush()

        mba_exam = db.execute(select(Exam).where(Exam.subject_code == "MBA101")).scalar_one_or_none()
        if not mba_exam:
            mba_exam = Exam(
                subject_code="MBA101",
                subject_name="Financial Accounting & Analysis (Mid-1)",
                exam_type="MID",
                exam_subdivision="MID_1",
                exam_date="2026-09-28",
                start_time="10:00 AM",
                end_time="01:00 PM",
                session="Morning (FN)",
                academic_year="2026-2027",
                semester=1,
                status="SCHEDULED"
            )
            db.add(mba_exam)
            db.flush()
        print("   Exams verified/created.")

        print("4. Registering Students to Exams...")
        cse_students = db.execute(
            select(Student).join(Department).where(Department.code == "CSE").limit(48)
        ).scalars().all()
        mba_students = db.execute(
            select(Student).join(Department).where(Department.code == "MBA").limit(48)
        ).scalars().all()

        existing_reg_cs = set(db.execute(
            select(ExamStudent.student_id).where(ExamStudent.exam_id == cs_exam.id)
        ).scalars().all())

        new_regs = []
        for s in cse_students:
            if s.id not in existing_reg_cs:
                new_regs.append(ExamStudent(exam_id=cs_exam.id, student_id=s.id))

        existing_reg_mba = set(db.execute(
            select(ExamStudent.student_id).where(ExamStudent.exam_id == mba_exam.id)
        ).scalars().all())

        for s in mba_students:
            if s.id not in existing_reg_mba:
                new_regs.append(ExamStudent(exam_id=mba_exam.id, student_id=s.id))

        if new_regs:
            db.add_all(new_regs)
            db.flush()
        print(f"   Registered {len(new_regs)} student-exam pairs.")

        db.commit()

        print("5. Generating Initial Seating Allocation...")
        r101 = db.execute(select(Room).where(Room.room_number == "101")).scalar_one()
        r102 = db.execute(select(Room).where(Room.room_number == "102")).scalar_one()

        engine = SeatingEngine(db)
        summary = engine.run_allocation(
            exam_ids=[cs_exam.id, mba_exam.id],
            room_ids=[r101.id, r102.id],
            department_codes=["CSE", "MBA"],
            exam_type="MID",
            exam_subdivision="MID_1",
            strategy="STRICT_ALTERNATE_BRANCH",
            arrangement_direction="COLUMN_WISE",
            auto_assign_invigilators=True
        )
        print(f"   Allocation generated! Total allocated: {summary.total_students_allocated} candidates.")
        db.commit()
        print("SUCCESS: Test environment ready!")
        return True

    except Exception as e:
        db.rollback()
        print(f"Error setting up test environment: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    setup_test_environment()
