"""
Generate comprehensive CREDENTIALS.md documentation from the live database.
Includes all batches:
- 4th Year B.Tech CSE (Sem 7)
- 3rd Year B.Tech CSE (Sem 5)
- 2nd Year B.Tech CSE (Sem 3)
- 2nd Year MBA (Sem 3)
- 1st Year MBA (Sem 1)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.academic import Department, Student
from app.models.user import User

def generate():
    db = SessionLocal()
    try:
        cse_dept = db.query(Department).filter(Department.code == "CSE").first()
        mba_dept = db.query(Department).filter(Department.code == "MBA").first()

        students_4th_cse = db.query(Student).filter(Student.department_id == cse_dept.id, Student.semester == 7).order_by(Student.roll_number).all() if cse_dept else []
        students_3rd_cse = db.query(Student).filter(Student.department_id == cse_dept.id, Student.semester == 5).order_by(Student.roll_number).all() if cse_dept else []
        students_2nd_cse = db.query(Student).filter(Student.department_id == cse_dept.id, Student.semester == 3).order_by(Student.roll_number).all() if cse_dept else []
        students_2nd_mba = db.query(Student).filter(Student.department_id == mba_dept.id, Student.semester == 3).order_by(Student.roll_number).all() if mba_dept else []
        students_1st_mba = db.query(Student).filter(Student.department_id == mba_dept.id, Student.semester == 1).order_by(Student.roll_number).all() if mba_dept else []

        total_students = len(students_4th_cse) + len(students_3rd_cse) + len(students_2nd_cse) + len(students_2nd_mba) + len(students_1st_mba)

        content = []
        content.append("# Gokula Krishna College of Engineering (GKCE)")
        content.append("## Autonomous Examination Cell — Credentials Registry")
        content.append("")
        content.append("> **Confidential**: For official Examination Cell administration and candidate portal access.")
        content.append("")
        content.append("---")
        content.append("")
        content.append("## 1. Administrative & Faculty Roles")
        content.append("")
        content.append("| Role | Authorized Identifier | Default Password | Portal URL | Access Scope |")
        content.append("|---|---|---|---|---|")
        content.append("| **Root Administrator** | `admin@gkce.edu.in` | `Admin@123` | [`http://localhost:3000/root/dashboard`](http://localhost:3000/root/dashboard) | Full control: Seating engine, rooms, duty rosters, batch imports |")
        content.append("")
        content.append("---")
        content.append("")
        content.append("## 2. Student Authentication Standard")
        content.append("")
        content.append("- **Login Identifier**: Roll Number (e.g. `24F81E0001`) or Institutional Email (`24f81e0001@gkce.edu.in`)")
        content.append("- **Default Password**: `gkce@1234`")
        content.append("- **Portal Gateway URL**: [`http://localhost:3000/login`](http://localhost:3000/login) (auto-redirects to `/student/dashboard`)")
        content.append("- **Candidate Dashboard Features**: Live Digital Desk Slip, Room / Bench / Seat allocation, Verification QR code, Attendance status, and Multi-exam schedule")
        content.append("")
        content.append("---")
        content.append("")

        # Section 3: 4th Year CSE
        content.append(f"## 3. 4th Year CSE Students Registry ({len(students_4th_cse)} Candidates)")
        content.append("")
        content.append("**Academic Year**: 2026-2027 | **Semester**: 7 | **Department**: Computer Science & Engineering (CSE)")
        content.append("")
        content.append("| S.No | Roll Number | Student Name | Institutional Email | Default Password | Section |")
        content.append("|---|---|---|---|---|---|")
        for idx, s in enumerate(students_4th_cse, 1):
            content.append(f"| {idx} | `{s.roll_number}` | {s.name} | `{s.email}` | `gkce@1234` | {s.section} |")
        content.append("")
        content.append("---")
        content.append("")

        # Section 4: 3rd Year CSE
        content.append(f"## 4. 3rd Year CSE Students Registry ({len(students_3rd_cse)} Candidates)")
        content.append("")
        content.append("**Academic Year**: 2026-2027 | **Semester**: 5 | **Department**: Computer Science & Engineering (CSE)")
        content.append("")
        content.append("| S.No | Roll Number | Student Name | Institutional Email | Default Password | Section |")
        content.append("|---|---|---|---|---|---|")
        for idx, s in enumerate(students_3rd_cse, 1):
            content.append(f"| {idx} | `{s.roll_number}` | {s.name} | `{s.email}` | `gkce@1234` | {s.section} |")
        content.append("")
        content.append("---")
        content.append("")

        # Section 5: 2nd Year CSE
        content.append(f"## 5. 2nd Year CSE Students Registry ({len(students_2nd_cse)} Candidates)")
        content.append("")
        content.append("**Academic Year**: 2026-2027 | **Semester**: 3 | **Department**: Computer Science & Engineering (CSE)")
        content.append("")
        content.append("| S.No | Roll Number | Student Name | Institutional Email | Default Password | Section |")
        content.append("|---|---|---|---|---|---|")
        for idx, s in enumerate(students_2nd_cse, 1):
            content.append(f"| {idx} | `{s.roll_number}` | {s.name} | `{s.email}` | `gkce@1234` | {s.section} |")
        content.append("")
        content.append("---")
        content.append("")

        # Section 6: 2nd Year MBA
        content.append(f"## 6. 2nd Year MBA Students Registry ({len(students_2nd_mba)} Candidates)")
        content.append("")
        content.append("**Academic Year**: 2026-2027 | **Semester**: 3 | **Department**: Master of Business Administration (MBA)")
        content.append("")
        content.append("| S.No | Roll Number | Student Name | Institutional Email | Default Password | Section |")
        content.append("|---|---|---|---|---|---|")
        for idx, s in enumerate(students_2nd_mba, 1):
            content.append(f"| {idx} | `{s.roll_number}` | {s.name} | `{s.email}` | `gkce@1234` | {s.section} |")
        content.append("")
        content.append("---")
        content.append("")

        # Section 7: 1st Year MBA
        content.append(f"## 7. 1st Year MBA Students Registry ({len(students_1st_mba)} Candidates)")
        content.append("")
        content.append("**Academic Year**: 2026-2027 | **Semester**: 1 | **Department**: Master of Business Administration (MBA)")
        content.append("")
        content.append("| S.No | Roll Number | Student Name | Institutional Email | Default Password | Section |")
        content.append("|---|---|---|---|---|---|")
        for idx, s in enumerate(students_1st_mba, 1):
            content.append(f"| {idx} | `{s.roll_number}` | {s.name} | `{s.email}` | `gkce@1234` | {s.section} |")
        content.append("")
        content.append("---")
        content.append("")

        content.append(f"**Total Active Accounts**: {total_students + 1} (1 Root Administrator + {len(students_4th_cse)} 4th Year CSE + {len(students_3rd_cse)} 3rd Year CSE + {len(students_2nd_cse)} 2nd Year CSE + {len(students_2nd_mba)} 2nd Year MBA + {len(students_1st_mba)} 1st Year MBA)")
        content.append("")

        target_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "CREDENTIALS.md"))
        with open(target_file, "w", encoding="utf-8") as f:
            f.write("\n".join(content))

        print(f"[SUCCESS] CREDENTIALS.md successfully written to: {target_file}")
        print(f"Total entries: 1 Admin + {len(students_4th_cse)} 4th Year CSE + {len(students_3rd_cse)} 3rd Year CSE + {len(students_2nd_cse)} 2nd Year CSE + {len(students_2nd_mba)} 2nd Year MBA + {len(students_1st_mba)} 1st Year MBA = {total_students + 1} accounts.")
        return True
    finally:
        db.close()

if __name__ == "__main__":
    generate()
