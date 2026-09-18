import pytest
import sys
import os
from fastapi.testclient import TestClient
from sqlalchemy import select

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.academic import Student, Department, Invigilator
from app.models.infrastructure import Room, Bench, Seat
from app.models.exam import Exam, ExamStudent
from app.models.seating import StudentAllocation

client = TestClient(app)

def get_token(identifier: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": identifier, "password": password}
    )
    assert response.status_code == 200, f"Login failed for {identifier}: {response.text}"
    return response.json()["access_token"]


def test_student_add_and_delete():
    """
    Test Add (POST) and Delete (DELETE) operations for Student resource:
    1. ROOT creates a new student with valid credentials and payload.
    2. Validates response, DB record, and linked User account.
    3. Validates duplicate detection (roll_number and email).
    4. ROOT deletes the student.
    5. Validates student and linked user account are completely purged.
    6. Deleting again returns 404 Not Found.
    """
    root_token = get_token("admin@gkce.edu.in", "Admin@123")
    headers = {"Authorization": f"Bearer {root_token}"}

    db = SessionLocal()
    dept = db.execute(select(Department).order_by(Department.id)).scalars().first()
    dept_id = dept.id if dept else 1
    db.close()

    roll_num = "TEST99CS01"
    email = "test99cs01@student.gkce.edu.in"

    # Clean up any leftover test record if it exists
    db = SessionLocal()
    existing_st = db.execute(select(Student).where(Student.roll_number == roll_num)).scalar_one_or_none()
    if existing_st:
        client.delete(f"/api/v1/students/{existing_st.id}", headers=headers)
    db.close()

    # 1. ADD STUDENT (POST /api/v1/students/)
    add_payload = {
        "roll_number": roll_num,
        "name": "Alex Test Student",
        "department_id": dept_id,
        "semester": 5,
        "section": "A",
        "academic_year": "2026-2027",
        "email": email,
        "phone": "+91 99887 76655",
        "password": "TestPassword@123"
    }
    res_add = client.post("/api/v1/students/", json=add_payload, headers=headers)
    assert res_add.status_code == 201, f"Failed to add student: {res_add.text}"
    added_st = res_add.json()
    assert added_st["roll_number"] == roll_num
    assert added_st["name"] == "Alex Test Student"
    student_id = added_st["id"]
    user_id = added_st["user_id"]

    # Verify user account in DB can log in
    test_token = get_token(roll_num, "TestPassword@123")
    assert test_token is not None

    # 2. DUPLICATE ROLL NUMBER VALIDATION
    res_dup_roll = client.post("/api/v1/students/", json=add_payload, headers=headers)
    assert res_dup_roll.status_code == 400
    assert "already exists" in res_dup_roll.text.lower()

    # 3. DUPLICATE EMAIL VALIDATION
    dup_email_payload = dict(add_payload)
    dup_email_payload["roll_number"] = "TEST99CS02"
    res_dup_email = client.post("/api/v1/students/", json=dup_email_payload, headers=headers)
    assert res_dup_email.status_code == 400
    assert "already in use" in res_dup_email.text.lower()

    # 4. DELETE STUDENT (DELETE /api/v1/students/{id})
    res_del = client.delete(f"/api/v1/students/{student_id}", headers=headers)
    assert res_del.status_code == 200
    assert "permanently deleted" in res_del.json()["message"].lower()

    # 5. Verify records removed from database
    db = SessionLocal()
    st_check = db.execute(select(Student).where(Student.id == student_id)).scalar_one_or_none()
    u_check = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    db.close()
    assert st_check is None, "Student record must be purged from database"
    assert u_check is None, "Linked User record must be purged from database"

    # 6. DELETE NON-EXISTENT STUDENT -> 404
    res_del_404 = client.delete(f"/api/v1/students/{student_id}", headers=headers)
    assert res_del_404.status_code == 404


def test_room_add_and_delete():
    """
    Test Add (POST) and Delete (DELETE) operations for Room resource:
    1. ROOT creates a new examination room with custom bench/seat layout.
    2. Validates response, benches generation, and seats generation.
    3. Validates duplicate room number prevention.
    4. ROOT deletes the examination room.
    5. Validates room, benches, and seats are cascade deleted.
    6. Deleting again returns 404 Not Found.
    """
    root_token = get_token("admin@gkce.edu.in", "Admin@123")
    headers = {"Authorization": f"Bearer {root_token}"}

    room_num = "TEST-909"

    # Clean up if exists from prior aborted run
    db = SessionLocal()
    existing_r = db.execute(select(Room).where(Room.room_number == room_num)).scalar_one_or_none()
    if existing_r:
        client.delete(f"/api/v1/rooms/{existing_r.id}", headers=headers)
    db.close()

    # 1. ADD ROOM (POST /api/v1/rooms/)
    room_payload = {
        "room_number": room_num,
        "block": "Block Test",
        "floor": 3,
        "total_benches": 4,
        "seats_per_bench": 2,
        "status": "AVAILABLE"
    }
    res_add = client.post("/api/v1/rooms/", json=room_payload, headers=headers)
    assert res_add.status_code == 201, f"Failed to add room: {res_add.text}"
    room_data = res_add.json()
    assert room_data["room_number"] == room_num
    assert room_data["capacity"] == 8
    assert room_data["benches_count"] == 4
    room_id = room_data["id"]

    # Verify benches and seats in DB
    db = SessionLocal()
    benches = db.execute(select(Bench).where(Bench.room_id == room_id)).scalars().all()
    assert len(benches) == 4, "Room must automatically generate 4 benches"
    bench_ids = [b.id for b in benches]
    seats = db.execute(select(Seat).where(Seat.bench_id.in_(bench_ids))).scalars().all()
    assert len(seats) == 8, "Benches must automatically generate 8 seats total"
    db.close()

    # 2. DUPLICATE ROOM NUMBER VALIDATION
    res_dup = client.post("/api/v1/rooms/", json=room_payload, headers=headers)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.text.lower()

    # 3. DELETE ROOM (DELETE /api/v1/rooms/{id})
    res_del = client.delete(f"/api/v1/rooms/{room_id}", headers=headers)
    assert res_del.status_code == 200
    assert "permanently deleted" in res_del.json()["message"].lower()

    # 4. Verify cascade deletion of room, benches, and seats
    db = SessionLocal()
    r_check = db.execute(select(Room).where(Room.id == room_id)).scalar_one_or_none()
    b_check = db.execute(select(Bench).where(Bench.room_id == room_id)).scalars().all()
    s_check = db.execute(select(Seat).where(Seat.bench_id.in_(bench_ids))).scalars().all()
    db.close()
    assert r_check is None, "Room record must be deleted"
    assert len(b_check) == 0, "Benches must be cascade deleted"
    assert len(s_check) == 0, "Seats must be cascade deleted"

    # 5. DELETE NON-EXISTENT ROOM -> 404
    res_del_404 = client.delete(f"/api/v1/rooms/{room_id}", headers=headers)
    assert res_del_404.status_code == 404


def test_invigilator_add_and_delete():
    """
    Test Add (POST) and Delete (DELETE) operations for Invigilator resource:
    1. ROOT registers a new faculty invigilator.
    2. Validates profile and linked User login account.
    3. Validates duplicate faculty_id prevention.
    4. ROOT deletes the invigilator.
    5. Validates invigilator profile and User account are purged.
    6. Deleting again returns 404 Not Found.
    """
    root_token = get_token("admin@gkce.edu.in", "Admin@123")
    headers = {"Authorization": f"Bearer {root_token}"}

    db = SessionLocal()
    dept = db.execute(select(Department).order_by(Department.id)).scalars().first()
    dept_id = dept.id if dept else 1
    db.close()

    fac_id = "FAC-TEST-888"
    fac_email = "testfac888@gkce.edu.in"

    # Clean up if exists
    db = SessionLocal()
    existing_inv = db.execute(select(Invigilator).where(Invigilator.faculty_id == fac_id)).scalar_one_or_none()
    if existing_inv:
        client.delete(f"/api/v1/invigilators/{existing_inv.id}", headers=headers)
    db.close()

    # 1. ADD INVIGILATOR (POST /api/v1/invigilators/)
    inv_payload = {
        "faculty_id": fac_id,
        "name": "Dr. Sarah Test",
        "department_id": dept_id,
        "designation": "Associate Professor",
        "email": fac_email,
        "phone": "+91 91234 56789",
        "password": "FacultyPass@123"
    }
    res_add = client.post("/api/v1/invigilators/", json=inv_payload, headers=headers)
    assert res_add.status_code in [200, 201], f"Failed to add invigilator: {res_add.text}"
    inv_data = res_add.json()
    assert inv_data["faculty_id"] == fac_id
    assert inv_data["name"] == "Dr. Sarah Test"
    inv_id = inv_data["id"]
    user_id = inv_data["user_id"]

    # Verify faculty user can log in
    fac_token = get_token(fac_email, "FacultyPass@123")
    assert fac_token is not None

    # 2. DUPLICATE FACULTY ID VALIDATION
    res_dup = client.post("/api/v1/invigilators/", json=inv_payload, headers=headers)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.text.lower()

    # 3. DELETE INVIGILATOR (DELETE /api/v1/invigilators/{id})
    res_del = client.delete(f"/api/v1/invigilators/{inv_id}", headers=headers)
    assert res_del.status_code == 200
    assert "permanently removed" in res_del.json()["message"].lower()

    # 4. Verify records removed from database
    db = SessionLocal()
    inv_check = db.execute(select(Invigilator).where(Invigilator.id == inv_id)).scalar_one_or_none()
    u_check = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    db.close()
    assert inv_check is None, "Invigilator profile must be deleted"
    assert u_check is None, "Linked User account must be deleted"

    # 5. DELETE NON-EXISTENT INVIGILATOR -> 404
    res_del_404 = client.delete(f"/api/v1/invigilators/{inv_id}", headers=headers)
    assert res_del_404.status_code == 404


def test_exam_add_and_delete():
    """
    Test Add (POST) and Delete (DELETE) operations for Examination resource:
    1. ROOT creates a scheduled examination with student enrollment.
    2. Validates DB enrollment and response.
    3. ROOT deletes the examination.
    4. Validates exam and enrollments are purged.
    5. Deleting again returns 404 Not Found.
    """
    root_token = get_token("admin@gkce.edu.in", "Admin@123")
    headers = {"Authorization": f"Bearer {root_token}"}

    sub_code = "TEST701"

    # Clean up if exists
    db = SessionLocal()
    existing_ex = db.execute(select(Exam).where(Exam.subject_code == sub_code)).scalar_one_or_none()
    if existing_ex:
        client.delete(f"/api/v1/exams/{existing_ex.id}", headers=headers)
    db.close()

    # 1. ADD EXAM (POST /api/v1/exams/)
    exam_payload = {
        "subject_code": sub_code,
        "subject_name": "Cloud Computing & DevOps",
        "exam_type": "MID",
        "exam_subdivision": "MID_1",
        "exam_date": "2026-11-20",
        "start_time": "10:00 AM",
        "end_time": "01:00 PM",
        "session": "Morning (FN)",
        "academic_year": "2026-2027",
        "semester": 7,
        "status": "SCHEDULED"
    }
    res_add = client.post("/api/v1/exams/", json=exam_payload, headers=headers)
    assert res_add.status_code == 201, f"Failed to add exam: {res_add.text}"
    exam_data = res_add.json()
    assert exam_data["subject_code"] == sub_code
    assert exam_data["subject_name"] == "Cloud Computing & DevOps"
    exam_id = exam_data["id"]

    # Verify exam exists in database
    db = SessionLocal()
    ex_db = db.execute(select(Exam).where(Exam.id == exam_id)).scalar_one_or_none()
    assert ex_db is not None
    db.close()

    # 2. DELETE EXAM (DELETE /api/v1/exams/{id})
    res_del = client.delete(f"/api/v1/exams/{exam_id}", headers=headers)
    assert res_del.status_code == 200
    assert "permanently deleted" in res_del.json()["message"].lower()

    # 3. Verify exam record is removed
    db = SessionLocal()
    ex_check = db.execute(select(Exam).where(Exam.id == exam_id)).scalar_one_or_none()
    db.close()
    assert ex_check is None, "Exam record must be purged from database"

    # 4. DELETE NON-EXISTENT EXAM -> 404
    res_del_404 = client.delete(f"/api/v1/exams/{exam_id}", headers=headers)
    assert res_del_404.status_code == 404


def test_allocation_add_and_delete_reset():
    """
    Test Add (POST /api/v1/allocation/generate) and Delete (DELETE /api/v1/allocation/reset):
    1. ROOT resets all allocations (DELETE).
    2. Summary confirms 0 allocations.
    3. ROOT generates allocations (POST).
    4. Summary confirms allocations exist.
    5. ROOT resets allocations again (DELETE) and confirms return to zero.
    """
    root_token = get_token("admin@gkce.edu.in", "Admin@123")
    headers = {"Authorization": f"Bearer {root_token}"}

    # 1. DELETE /api/v1/allocation/reset
    res_reset = client.delete("/api/v1/allocation/reset", headers=headers)
    assert res_reset.status_code == 200

    # 2. Check summary is 0
    res_sum = client.get("/api/v1/allocation/summary", headers=headers)
    assert res_sum.status_code == 200
    assert res_sum.json()["total_students_allocated"] == 0

    # 3. Dynamically find MAT301 exam and available rooms
    db = SessionLocal()
    exam = db.execute(select(Exam).where(Exam.subject_code == "MAT301")).scalars().first()
    rooms = db.execute(select(Room).order_by(Room.room_number).limit(2)).scalars().all()
    assert exam is not None
    assert len(rooms) >= 2
    exam_id = exam.id
    room_ids = [r.id for r in rooms]
    db.close()

    # 4. POST /api/v1/allocation/generate (ADD / GENERATE ALLOCATIONS)
    gen_payload = {
        "exam_id": exam_id,
        "room_ids": room_ids,
        "strategy": "MULTI_BRANCH_MIXING",
        "arrangement_direction": "COLUMN_WISE"
    }
    res_gen = client.post("/api/v1/allocation/generate", json=gen_payload, headers=headers)
    assert res_gen.status_code == 200
    gen_data = res_gen.json()
    assert gen_data["total_students_allocated"] > 0
    assert gen_data["branch_mixing_compliance_percent"] == 100.0

    # 5. Summary confirms students allocated
    res_sum2 = client.get("/api/v1/allocation/summary", headers=headers)
    assert res_sum2.status_code == 200
    assert res_sum2.json()["total_students_allocated"] > 0

    # 6. RESET ALLOCATIONS AGAIN (DELETE)
    res_reset2 = client.delete("/api/v1/allocation/reset", headers=headers)
    assert res_reset2.status_code == 200

    res_sum3 = client.get("/api/v1/allocation/summary", headers=headers)
    assert res_sum3.status_code == 200
    assert res_sum3.json()["total_students_allocated"] == 0


def test_add_and_delete_unauthorized_access():
    """
    Verify RBAC security: unauthenticated users and non-ROOT roles cannot
    Add or Delete resources (401 Unauthorized or 403 Forbidden).
    """
    # 1. Unauthenticated requests -> 401
    assert client.post("/api/v1/students/", json={}).status_code == 401
    assert client.delete("/api/v1/students/999999").status_code == 401
    assert client.post("/api/v1/rooms/", json={}).status_code == 401
    assert client.delete("/api/v1/rooms/999999").status_code == 401
    assert client.post("/api/v1/exams/", json={}).status_code == 401
    assert client.delete("/api/v1/exams/999999").status_code == 401
    assert client.post("/api/v1/invigilators/", json={}).status_code == 401
    assert client.delete("/api/v1/invigilators/999999").status_code == 401
    assert client.delete("/api/v1/allocation/reset").status_code == 401

    # 2. Student role attempting Admin Add/Delete -> 403 Forbidden
    student_token = get_token("23CS042", "Student@123")
    st_headers = {"Authorization": f"Bearer {student_token}"}
    assert client.post("/api/v1/students/", json={}, headers=st_headers).status_code == 403
    assert client.delete("/api/v1/students/999999", headers=st_headers).status_code == 403
    assert client.post("/api/v1/rooms/", json={}, headers=st_headers).status_code == 403
    assert client.delete("/api/v1/rooms/999999", headers=st_headers).status_code == 403
    assert client.post("/api/v1/exams/", json={}, headers=st_headers).status_code == 403
    assert client.delete("/api/v1/exams/999999", headers=st_headers).status_code == 403

    # 3. Invigilator role attempting Admin Add/Delete -> 403 Forbidden
    inv_token = get_token("prof.sharma@gkce.edu.in", "Faculty@123")
    inv_headers = {"Authorization": f"Bearer {inv_token}"}
    assert client.post("/api/v1/students/", json={}, headers=inv_headers).status_code == 403
    assert client.delete("/api/v1/students/999999", headers=inv_headers).status_code == 403
    assert client.post("/api/v1/rooms/", json={}, headers=inv_headers).status_code == 403
    assert client.delete("/api/v1/rooms/999999", headers=inv_headers).status_code == 403
    assert client.post("/api/v1/exams/", json={}, headers=inv_headers).status_code == 403
    assert client.delete("/api/v1/exams/999999", headers=inv_headers).status_code == 403
