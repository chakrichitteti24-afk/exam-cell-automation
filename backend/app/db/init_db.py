from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from app.db.base import Base
from app.db.session import engine
from app.core.security import get_password_hash
from app.models.user import User
from app.models.academic import Department, Student, Invigilator
from app.models.infrastructure import Room, Bench, Seat
from app.models.exam import Exam, ExamStudent
from app.models.seating import StudentAllocation, InvigilatorAllocation, AttendanceRecord


def init_db(db: Session, force: bool = False) -> None:
    """
    Initialize the GKCE Exam Cell database with comprehensive infrastructure,
    departmental exams (CSE, ECE, CIVIL, MECH, EEE), student roll rosters with unique credentials,
    and faculty invigilators.
    """
    # 1. Create tables if they do not exist
    Base.metadata.create_all(bind=engine)

    # 2. Check if already initialized (unless forced)
    existing_root = db.execute(
        select(User).where(User.email == "admin@gkce.edu.in")
    ).scalar_one_or_none()

    existing_student_test = db.execute(
        select(User).where(User.username == "23CS042")
    ).scalar_one_or_none()

    if existing_root and existing_student_test and not force:
        print("Database already initialized with complete presets. Skipping.")
        return

    print("Initializing GKCE database with comprehensive multi-section presets...")

    # Clear old data if re-initializing
    if force or not existing_student_test:
        db.commit()
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    # 3. Departments
    depts_data = [
        ("CSE",   "Computer Science & Engineering"),
        ("ECE",   "Electronics & Communication Engineering"),
        ("EEE",   "Electrical & Electronics Engineering"),
        ("MECH",  "Mechanical Engineering"),
        ("CIVIL", "Civil Engineering"),
    ]
    dept_objs = {}
    for code, name in depts_data:
        dept = Department(code=code, name=name)
        db.add(dept)
        db.flush()
        dept_objs[code] = dept

    # 4. Root Administrator
    root_user = User(
        email="admin@gkce.edu.in",
        username="admin",
        hashed_password=get_password_hash("Admin@123"),
        role="ROOT",
        full_name="Controller of Examinations"
    )
    db.add(root_user)

    # 5. Examination Rooms (4 halls with 24 benches each, 2 seats per bench = 48 capacity)
    rooms_config = [
        ("101", "Block A", "1st Floor"),
        ("102", "Block A", "1st Floor"),
        ("201", "Block B", "2nd Floor"),
        ("202", "Block B", "2nd Floor"),
    ]
    room_objs = {}
    for r_num, block, floor in rooms_config:
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
        db.flush()
        room_objs[r_num] = room

        for b_num in range(1, 25):
            col_idx = ((b_num - 1) % 4) + 1
            row_idx = ((b_num - 1) // 4) + 1
            bench = Bench(
                room_id=room.id,
                bench_number=b_num,
                row_index=row_idx,
                col_index=col_idx
            )
            db.add(bench)
            db.flush()

            db.add_all([
                Seat(bench_id=bench.id, seat_number=1, seat_label="Seat 01"),
                Seat(bench_id=bench.id, seat_number=2, seat_label="Seat 02"),
            ])

    # 6. Faculty Invigilators across departments
    faculty_data = [
        ("prof.sharma@gkce.edu.in", "FAC-CSE-001", "Dr. Ramesh Sharma", "CSE", "Professor & Head"),
        ("prof.varma@gkce.edu.in",  "FAC-ECE-002", "Prof. K. Varma",    "ECE", "Associate Professor"),
        ("prof.rao@gkce.edu.in",    "FAC-CE-003",  "Dr. S. Rao",        "CIVIL", "Assistant Professor"),
        ("prof.reddy@gkce.edu.in",  "FAC-ME-004",  "Prof. M. Reddy",    "MECH", "Associate Professor"),
        ("prof.kumar@gkce.edu.in",  "FAC-EE-005",  "Dr. P. Kumar",      "EEE", "Professor"),
        ("prof.shankar@gkce.edu.in","FAC-HNS-006", "Dr. B. Shankar",    "CSE", "Assistant Professor"),
    ]
    faculty_pw = get_password_hash("Faculty@123")
    invig_objs = []
    for email, fac_id, name, dept_code, desig in faculty_data:
        u = User(
            email=email,
            username=fac_id,
            hashed_password=faculty_pw,
            role="INVIGILATOR",
            full_name=name
        )
        db.add(u)
        db.flush()

        inv = Invigilator(
            user_id=u.id,
            faculty_id=fac_id,
            name=name,
            department_id=dept_objs[dept_code].id,
            designation=desig,
            email=email,
            phone="+91 98765 43210"
        )
        db.add(inv)
        invig_objs.append(inv)
    db.flush()

    # 7. Scheduled Examinations (Mid-1 & Mid-2 [2 students/bench] & Semester Regular / Supplementary [1 student/bench])
    exams_data = [
        # Common Mid-1 Exam (2026-09-15) -> (2 students per bench)
        ("MAT301","Mathematics - III (Mid-1 Exam)",            "2026-09-15", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "ALL", "MID", "MID_1"),
        # Concurrent Multi-Exam Session for Mid-2 Exams (2026-09-28, Morning FN, Semester 5)
        ("CS301", "Data Structures & Algorithms (Mid-2)",      "2026-09-28", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "CSE", "MID", "MID_2"),
        ("EC301", "Digital Signal Processing (Mid-2)",          "2026-09-28", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "ECE", "MID", "MID_2"),
        ("CE301", "Structural Analysis (Mid-2)",                "2026-09-28", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "CIVIL", "MID", "MID_2"),
        ("ME301", "Heat Transfer & Thermodynamics (Mid-2)",     "2026-09-28", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "MECH", "MID", "MID_2"),
        ("EE301", "Power Systems & Control (Mid-2)",            "2026-09-28", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "EEE", "MID", "MID_2"),
        # Common Semester Regular End Examination -> (1 student per bench, single-seater policy!)
        ("MAT302","Mathematics - III (Semester Regular)",      "2026-10-15", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "ALL", "SEM", "REGULAR"),
        # Departmental Semester Supplementary Examinations (1 student per bench, single-seater policy!)
        ("CS501", "Design & Analysis of Algorithms (Sem Supply)", "2026-10-20", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "CSE", "SEM", "SUPPLEMENTARY"),
        ("EC501", "Microcontrollers & Embedded (Sem Supply)",    "2026-10-20", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "ECE", "SEM", "SUPPLEMENTARY"),
        ("CE501", "Concrete Technology & Design (Sem Supply)",   "2026-10-20", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "CIVIL", "SEM", "SUPPLEMENTARY"),
        ("ME501", "Dynamics of Machinery (Sem Supply)",          "2026-10-20", "10:00 AM", "01:00 PM", "Morning (FN)", 5, "SCHEDULED", "MECH", "SEM", "SUPPLEMENTARY"),
    ]
    exam_objs = {}
    for code, name, dt, st_time, end_time, sess, sem, stat, dept_target, ex_type, ex_subdiv in exams_data:
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
        db.add(ex)
        db.flush()
        exam_objs[code] = (ex, dept_target)

    # 8. Students with Unique Roll Numbers Across Every Section
    # Student password hash: Student@123
    student_pw = get_password_hash("Student@123")

    first_names = [
        "Aarav", "Rahul", "Priya", "Sneha", "Rohan", "Ananya", "Vikram", "Neha",
        "Aditya", "Pooja", "Suresh", "Divya", "Karthik", "Swathi", "Manoj", "Kavya",
        "Sanjay", "Anjali", "Varun", "Deepa", "Rajesh", "Meera", "Akhil", "Lavanya",
        "Harish", "Bhavya", "Naveen", "Sindhu", "Pranav", "Harini", "Tarun", "Preeti",
        "Gautam", "Aishwarya", "Vikas", "Roopa", "Ashwin", "Sunita", "Nikhil", "Suma",
        "Surya", "Sandhya", "Deepak", "Keerthi", "Abhishek", "Shilpa", "Vinay", "Sangeetha"
    ]
    last_names = [
        "Patel", "Reddy", "Sharma", "Varma", "Rao", "Nair", "Iyer", "Kumar",
        "Gupta", "Singh", "Joshi", "Babu", "Chowdary", "Naidu", "Prasad", "Murthy"
    ]

    branch_specs = [
        ("CSE",   "23CS", 48),  # 48 students: 23CS001 to 23CS048 (includes 23CS042)
        ("ECE",   "23EC", 24),  # 24 students: 23EC001 to 23EC024
        ("CIVIL", "23CE", 24),  # 24 students: 23CE001 to 23CE024
        ("MECH",  "23ME", 24),  # 24 students: 23ME001 to 23ME024
        ("EEE",   "23EE", 24),  # 24 students: 23EE001 to 23EE024
    ]

    all_created_students = []

    for dept_code, prefix, count in branch_specs:
        dept = dept_objs[dept_code]
        for num in range(1, count + 1):
            roll = f"{prefix}{num:03d}"
            # Ensure 23CS042 is Aarav Patel
            if roll == "23CS042":
                st_name = "Aarav Patel"
            else:
                fn = first_names[(num - 1) % len(first_names)]
                ln = last_names[((num - 1) // 3) % len(last_names)]
                st_name = f"{fn} {ln}"

            email = f"{roll.lower()}@student.gkce.edu.in"

            u = User(
                email=email,
                username=roll,
                hashed_password=student_pw,
                role="STUDENT",
                full_name=st_name
            )
            db.add(u)
            db.flush()

            st = Student(
                user_id=u.id,
                roll_number=roll,
                name=st_name,
                department_id=dept.id,
                semester=5,
                section="A" if num <= 24 else "B",
                academic_year="2026-2027",
                email=email,
                phone=f"+91 98765 {num:05d}"
            )
            db.add(st)
            db.flush()
            all_created_students.append((st, dept_code))

            # 9. Register Student in Corresponding Departmental Exams & Common Exams
            # Register in Common Mid Exam MAT301 and Semester Exam MAT302 for CSE (48), ECE (24), and CIVIL (24) -> Exactly 96 candidates
            if dept_code in ["CSE", "ECE", "CIVIL"]:
                mat301_ex, _ = exam_objs["MAT301"]
                db.add(ExamStudent(exam_id=mat301_ex.id, student_id=st.id))
                if "MAT302" in exam_objs:
                    mat302_ex, _ = exam_objs["MAT302"]
                    db.add(ExamStudent(exam_id=mat302_ex.id, student_id=st.id))

            # Register in Departmental Exam (CS301, EC301, CE301, ME301, EE301)
            dept_exam_code = f"{dept_code[:2]}301" if dept_code != "CIVIL" else "CE301"
            if dept_code == "MECH":
                dept_exam_code = "ME301"
            if dept_exam_code in exam_objs:
                dept_ex, _ = exam_objs[dept_exam_code]
                db.add(ExamStudent(exam_id=dept_ex.id, student_id=st.id))

            # Register in 500-Series Departmental Exam (CS501, EC501, CE501, ME501)
            dept_exam_500 = f"{dept_code[:2]}501" if dept_code != "CIVIL" else "CE501"
            if dept_code == "MECH":
                dept_exam_500 = "ME501"
            if dept_exam_500 in exam_objs:
                dept_ex5, _ = exam_objs[dept_exam_500]
                db.add(ExamStudent(exam_id=dept_ex5.id, student_id=st.id))

    db.commit()

    print(
        f"GKCE database initialized successfully with comprehensive multi-section presets.\n"
        f"  Admin:       admin@gkce.edu.in / Admin@123\n"
        f"  Invigilators: {len(faculty_data)} faculty registered (prof.sharma@gkce.edu.in, prof.varma@gkce.edu.in, etc.)\n"
        f"  Departments: CSE, ECE, EEE, MECH, CIVIL\n"
        f"  Halls:       101, 102 (Block A) | 201, 202 (Block B) (24 benches / 48 capacity each)\n"
        f"  Exams:       CS301, EC301, CE301, ME301, EE301, MAT301, CS501, EC501, CE501, ME501\n"
        f"  Students:    {len(all_created_students)} candidates with unique roll numbers (password: Student@123)\n"
        f"               - CSE:   48 students (23CS001 - 23CS048, including 23CS042 Aarav Patel)\n"
        f"               - ECE:   24 students (23EC001 - 23EC024)\n"
        f"               - CIVIL: 24 students (23CE001 - 23CE024)\n"
        f"               - MECH:  24 students (23ME001 - 23ME024)\n"
        f"               - EEE:   24 students (23EE001 - 23EE024)\n"
    )
