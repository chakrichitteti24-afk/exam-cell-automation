"""
Database Initialization and Administration CLI for GKCE Exam Cell Automation System
"""
import sys
import os
import argparse

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.db.init_db import init_db, create_admin_user
from app.core.security import get_password_hash
from app.models.user import User
from app.models.academic import Department, Student, Invigilator
from app.models.infrastructure import Room, Bench, Seat
from app.models.exam import Exam, ExamStudent

def seed_demo_data(db: Session):
    """
    Populate standard GKCE demonstration and institutional data:
    - Root Administrator: admin@gkce.edu.in (Password: Admin@123)
    - Faculty Invigilators: prof.sharma@gkce.edu.in (Password: Faculty@123)
    - Students: 23cs001@student.gkce.edu.in (Password: Student@123)
    - Examination Halls: Room 101, 102, 201, 202 with 24 benches each
    - Exams: CS301, EC301, EE301, ME301, CE301, MAT301, MAT302
    """
    print("Seeding standard GKCE demonstration data...")
    Base.metadata.create_all(bind=engine)

    depts_data = [
        ("CSE",   "Computer Science & Engineering"),
        ("ECE",   "Electronics & Communication Engineering"),
        ("EEE",   "Electrical & Electronics Engineering"),
        ("MECH",  "Mechanical Engineering"),
        ("CIVIL", "Civil Engineering"),
    ]
    dept_objs = {}
    for code, name in depts_data:
        existing = db.execute(select(Department).where(Department.code == code)).scalar_one_or_none()
        if not existing:
            dept = Department(code=code, name=name)
            db.add(dept)
            db.flush()
            dept_objs[code] = dept
        else:
            dept_objs[code] = existing

    # Root Admin
    admin_pw = get_password_hash("Admin@123")
    existing_admin = db.execute(select(User).where(User.email == "admin@gkce.edu.in")).scalar_one_or_none()
    if not existing_admin:
        root_user = User(
            email="admin@gkce.edu.in",
            username="admin",
            hashed_password=admin_pw,
            role="ROOT",
            full_name="Controller of Examinations"
        )
        db.add(root_user)
    else:
        existing_admin.hashed_password = admin_pw

    # Rooms & Benches
    rooms_config = [
        ("101", "Block A", "1st Floor"),
        ("102", "Block A", "1st Floor"),
        ("201", "Block B", "2nd Floor"),
        ("202", "Block B", "2nd Floor"),
    ]
    existing_rooms = {r.room_number: r for r in db.execute(select(Room)).scalars().all()}
    new_rooms = []
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
            new_rooms.append((r_num, room))
    if new_rooms:
        db.flush()
        all_benches = []
        for r_num, room in new_rooms:
            existing_rooms[r_num] = room
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

    # Faculty
    faculty_data = [
        ("prof.sharma@gkce.edu.in", "FAC-CSE-001", "Dr. Ramesh Sharma", "CSE", "Professor & Head"),
        ("prof.varma@gkce.edu.in",  "FAC-ECE-002", "Prof. K. Varma",    "ECE", "Associate Professor"),
        ("prof.rao@gkce.edu.in",    "FAC-CE-003",  "Dr. S. Rao",        "CIVIL", "Assistant Professor"),
        ("prof.reddy@gkce.edu.in",  "FAC-ME-004",  "Prof. M. Reddy",    "MECH", "Associate Professor"),
        ("prof.kumar@gkce.edu.in",  "FAC-EE-005",  "Dr. P. Kumar",      "EEE", "Professor"),
        ("prof.shankar@gkce.edu.in","FAC-HNS-006", "Dr. B. Shankar",    "CSE", "Assistant Professor"),
    ]
    fac_pw = get_password_hash("Faculty@123")
    existing_users = {u.email: u for u in db.execute(select(User).where(User.email.in_([f[0] for f in faculty_data]))).scalars().all()}
    new_fac_users = []
    fac_meta = []
    for email, fac_id, name, dept_code, desig in faculty_data:
        if email in existing_users:
            existing_users[email].hashed_password = fac_pw
        else:
            u = User(email=email, username=fac_id, hashed_password=fac_pw, role="INVIGILATOR", full_name=name)
            new_fac_users.append(u)
            fac_meta.append((fac_id, name, dept_objs[dept_code].id, desig, email))
    if new_fac_users:
        db.add_all(new_fac_users)
        db.flush()
        inv_objs = []
        for u, (fac_id, name, dept_id, desig, email) in zip(new_fac_users, fac_meta):
            inv = Invigilator(user_id=u.id, faculty_id=fac_id, name=name, department_id=dept_id, designation=desig, email=email, phone="+91 98765 43210")
            inv_objs.append(inv)
        db.add_all(inv_objs)
        db.flush()

    # Exams
    exams_data = [
        ("MAT301","Mathematics - III (Mid-1 Exam)",            "2026-09-15", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "ALL", "MID", "MID_1"),
        ("CS301", "Data Structures & Algorithms (Mid-2)",      "2026-09-28", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "CSE", "MID", "MID_2"),
        ("EC301", "Digital Signal Processing (Mid-2)",          "2026-09-28", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "ECE", "MID", "MID_2"),
        ("CE301", "Structural Analysis (Mid-2)",                "2026-09-28", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "CIVIL", "MID", "MID_2"),
        ("ME301", "Heat Transfer & Thermodynamics (Mid-2)",     "2026-09-28", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "MECH", "MID", "MID_2"),
        ("EE301", "Power Systems & Control (Mid-2)",            "2026-09-28", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "EEE", "MID", "MID_2"),
        ("MAT302","Mathematics - III (Semester Regular)",      "2026-10-15", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "ALL", "SEM", "REGULAR"),
    ]
    exam_objs = {}
    new_exams = []
    for code, name, dt, st_time, end_time, sess, sem, stat, dept_target, ex_type, ex_subdiv in exams_data:
        ex = db.execute(select(Exam).where(Exam.subject_code == code, Exam.exam_type == ex_type)).scalar_one_or_none()
        if not ex:
            ex = Exam(
                subject_code=code,
                subject_name=name,
                exam_type=ex_type,
                exam_subdivision=ex_subdiv,
                exam_date=dt,
                start_time=st_time,
                end_time=end_time,
                session=sess,
                academic_year="2026-2027",
                semester=sem,
                status=stat
            )
            new_exams.append((code, ex))
        else:
            exam_objs[code] = ex
    if new_exams:
        db.add_all([ex for _, ex in new_exams])
        db.flush()
        for code, ex in new_exams:
            exam_objs[code] = ex

    # Students
    student_pw = get_password_hash("Student@123")
    branch_specs = [
        ("CSE",   "23CS", 48),
        ("ECE",   "23EC", 24),
        ("CIVIL", "23CE", 24),
        ("MECH",  "23ME", 24),
        ("EEE",   "23EE", 24),
    ]
    all_rolls = []
    for dept_code, prefix, count in branch_specs:
        for num in range(1, count + 1):
            all_rolls.append(f"{prefix}{num:03d}")

    existing_rolls = set(db.execute(select(Student.roll_number).where(Student.roll_number.in_(all_rolls))).scalars().all())

    new_st_users = []
    st_meta = []
    for dept_code, prefix, count in branch_specs:
        dept = dept_objs[dept_code]
        for num in range(1, count + 1):
            roll = f"{prefix}{num:03d}"
            if roll in existing_rolls:
                continue
            st_name = "Aarav Patel" if roll == "23CS042" else ("Aarav Sharma" if roll == "23CS001" else f"Student {roll}")
            email = f"{roll.lower()}@student.gkce.edu.in"
            u = User(email=email, username=roll, hashed_password=student_pw, role="STUDENT", full_name=st_name)
            new_st_users.append(u)
            st_meta.append((roll, st_name, dept.id, num, email, dept_code))

    if new_st_users:
        db.add_all(new_st_users)
        db.flush()

        new_students = []
        for u, (roll, st_name, dept_id, num, email, dept_code) in zip(new_st_users, st_meta):
            st = Student(
                user_id=u.id,
                roll_number=roll,
                name=st_name,
                department_id=dept_id,
                semester=5,
                section="A" if num <= 24 else "B",
                academic_year="2026-2027",
                email=email,
                phone=f"+91 98765 {num:05d}"
            )
            new_students.append((st, dept_code))

        db.add_all([st for st, _ in new_students])
        db.flush()

        exam_regs = []
        for st, dept_code in new_students:
            if "MAT301" in exam_objs:
                exam_regs.append(ExamStudent(exam_id=exam_objs["MAT301"].id, student_id=st.id))
            if "MAT302" in exam_objs:
                exam_regs.append(ExamStudent(exam_id=exam_objs["MAT302"].id, student_id=st.id))
            dept_exam_code = f"{dept_code[:2]}301" if dept_code != "CIVIL" else "CE301"
            if dept_code == "MECH":
                dept_exam_code = "ME301"
            if dept_exam_code in exam_objs:
                exam_regs.append(ExamStudent(exam_id=exam_objs[dept_exam_code].id, student_id=st.id))

        if exam_regs:
            db.add_all(exam_regs)
            db.flush()

    db.commit()
    print("Demo data successfully seeded into database.")

from clear_fake_data import clear_all_fake_data

def main():
    parser = argparse.ArgumentParser(description="GKCE Exam Cell Database Management CLI")
    parser.add_argument(
        "--create-admin",
        action="store_true",
        help="Create or update an administrative account"
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Seed full demonstration database with admin, faculty, students, rooms, and exams"
    )
    parser.add_argument(
        "--clear-data",
        action="store_true",
        help="Purge all fake / demonstration data (students, invigilators, rooms, exams, allocations)"
    )
    parser.add_argument(
        "--email",
        type=str,
        help="Administrator email address"
    )
    parser.add_argument(
        "--password",
        type=str,
        help="Administrator password"
    )
    parser.add_argument(
        "--name",
        type=str,
        default="Controller of Examinations",
        help="Administrator full name"
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        init_db(db)

        if args.clear_data:
            clear_all_fake_data(db)
        elif args.demo:
            seed_demo_data(db)
        elif args.create_admin:
            if not args.email or not args.password:
                print("Error: --email and --password are required when using --create-admin.")
                sys.exit(1)
            admin = create_admin_user(
                db=db,
                email=args.email.strip(),
                password=args.password,
                username="admin",
                full_name=args.name
            )
            print(f"Administrator successfully created/updated: {admin.email}")
        else:
            print("Database initialized with standard schema and departments.")
            print("To seed complete demo data, run: python seed.py --demo")
    except Exception as e:
        print(f"Database error: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    main()
