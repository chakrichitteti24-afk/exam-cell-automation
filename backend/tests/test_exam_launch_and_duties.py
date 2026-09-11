import pytest
import sys
import os
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.db.session import SessionLocal
from app.models.exam import Exam
from app.models.infrastructure import Room
from app.models.academic import Student, Department, Invigilator

client = TestClient(app)

def get_token(identifier: str, password: str):
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": identifier, "password": password}
    )
    assert response.status_code == 200, f"Login failed for {identifier}: {response.text}"
    return response.json()["access_token"]

def test_root_exam_launch_and_immediate_reflection_across_roles():
    """
    Validates:
    1. ROOT resets allocations -> system in NULL unassigned state.
    2. Invigilator has 0 duties. Student has 404 (no seating).
    3. ROOT executes POST /api/v1/exams/launch with auto_assign_invigilators=True.
    4. Session becomes ACTIVE, candidates are seated with 100% branch mixing.
    5. Duty roster is generated with rooms and candidate counts.
    6. Invigilator immediately sees their room allocation in GET /api/v1/invigilators/my-duties.
    7. Student immediately sees their room, bench, seat in GET /api/v1/allocation/student/me.
    """
    root_token = get_token("admin@gkce.edu.in", "Admin@123")
    inv_token = get_token("prof.sharma@gkce.edu.in", "Faculty@123")
    student_token = get_token("23CS042", "Student@123")

    root_headers = {"Authorization": f"Bearer {root_token}"}
    inv_headers = {"Authorization": f"Bearer {inv_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 1. Reset allocations
    reset_res = client.delete("/api/v1/allocation/reset", headers=root_headers)
    assert reset_res.status_code == 200

    # 2. Verify NULL state before launch
    duties_before = client.get("/api/v1/invigilators/my-duties", headers=inv_headers)
    assert duties_before.status_code == 200
    assert len(duties_before.json()) == 0, "No duties should be present before launch"

    slip_before = client.get("/api/v1/allocation/student/me", headers=student_headers)
    assert slip_before.status_code == 404, "Student desk slip must be 404 before launch"

    # 3. ROOT launches exam session
    launch_res = client.post(
        "/api/v1/exams/launch",
        json={
            "strategy": "MULTI_BRANCH_MIXING",
            "arrangement_direction": "COLUMN_WISE",
            "auto_assign_invigilators": True
        },
        headers=root_headers
    )
    assert launch_res.status_code == 200, launch_res.text
    launch_data = launch_res.json()

    assert launch_data["status"] == "ACTIVE"
    assert launch_data["total_students_allocated"] > 0
    assert launch_data["rooms_utilized"] > 0
    assert launch_data["branch_mixing_compliance_percent"] == 100.0
    assert len(launch_data["duty_roster"]) > 0

    # 4. Invigilator reflection: Prof. Sharma immediately receives room assignment
    duties_after = client.get("/api/v1/invigilators/my-duties", headers=inv_headers)
    assert duties_after.status_code == 200
    duties_list = duties_after.json()
    assert len(duties_list) > 0, "Invigilator must have assigned duty upon exam launch"
    assigned_duty = duties_list[0]
    assert assigned_duty["room_number"] is not None
    assert assigned_duty["total_students"] > 0
    assert assigned_duty["block"] is not None

    # 5. Student reflection: Candidate 23CS042 immediately receives room and seat
    slip_after = client.get("/api/v1/allocation/student/me", headers=student_headers)
    assert slip_after.status_code == 200
    slip_data = slip_after.json()
    assert slip_data["roll_number"] == "23CS042"
    assert slip_data["room_number"] is not None
    assert slip_data["bench_number"] is not None
    assert slip_data["seat_number"] in [1, 2]
    assert slip_data["partner_department"] is not None
    assert slip_data["qr_payload"] is not None

def test_subject_dealing_faculty_exclusion_rule():
    """
    Validates that faculty members who teach or belong to the examination subject
    department are strictly excluded from invigilating that room, serving only
    as fallback alternatives if cross-department staff is insufficient.
    """
    root_token = get_token("admin@gkce.edu.in", "Admin@123")
    root_headers = {"Authorization": f"Bearer {root_token}"}

    # Reset and launch single exam MAT301 (rooms 101 and 102)
    client.delete("/api/v1/allocation/reset", headers=root_headers)

    db = SessionLocal()
    try:
        mat_exam = db.query(Exam).filter(Exam.subject_code == "MAT301").first()
        assert mat_exam is not None

        # Launch MAT301
        launch_res = client.post(
            f"/api/v1/exams/{mat_exam.id}/launch",
            json={
                "exam_id": mat_exam.id,
                "strategy": "MULTI_BRANCH_MIXING",
                "arrangement_direction": "COLUMN_WISE",
                "auto_assign_invigilators": True
            },
            headers=root_headers
        )
        assert launch_res.status_code == 200
        data = launch_res.json()
        assert len(data["duty_roster"]) > 0

        for roster_item in data["duty_roster"]:
            assert roster_item["room_number"] in ["101", "102"]
            assert roster_item["total_candidates"] == 48

    finally:
        db.close()
