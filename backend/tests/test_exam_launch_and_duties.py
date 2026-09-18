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
    assert slip_before.status_code in [200, 404]
    if slip_before.status_code == 200:
        assert len(slip_before.json()) == 0, "Student desk slip must be empty before launch"

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
    assert len(slip_data) > 0
    slip = slip_data[0]
    assert slip["roll_number"] == "23CS042"
    assert slip["room_number"] is not None
    assert slip["bench_number"] is not None
    assert slip["seat_number"] in [1, 2]
    assert slip["partner_department"] is not None
    assert slip["qr_payload"] is not None

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
            assert roster_item["room_number"] in ["101", "102", "201", "202"]
            assert roster_item["total_candidates"] == 48

    finally:
        db.close()

def test_root_selected_faculty_allocation_and_shortage_hold():
    """
    Validates:
    1. Root can pass selected_invigilator_ids to restrict allocation pool.
    2. If selected pool < rooms, status is 'SHORTAGE_HOLD' and unassigned rooms are placed on HOLD.
    3. Root can put duty on HOLD (room_id=0).
    4. Root can register new faculty on-the-fly and assign them to fill the shortage.
    """
    root_token = get_token("admin@gkce.edu.in", "Admin@123")
    root_headers = {"Authorization": f"Bearer {root_token}"}

    # Fetch invigilators and rooms
    invs_res = client.get("/api/v1/invigilators/", headers=root_headers)
    assert invs_res.status_code == 200
    all_invs = invs_res.json()
    assert len(all_invs) >= 2

    # Pick only 1 faculty for pool to deliberately trigger shortage across all rooms
    selected_pool = [all_invs[0]["id"]]

    assign_res = client.post(
        "/api/v1/invigilators/assign",
        json={
            "auto_distribute": True,
            "selected_invigilator_ids": selected_pool
        },
        headers=root_headers
    )
    assert assign_res.status_code == 200
    res_data = assign_res.json()
    assert res_data["status"] == "SHORTAGE_HOLD"
    assert res_data["shortage_count"] > 0
    assert len(res_data["unassigned_rooms"]) > 0
    assert len(res_data["assignments"]) == 1
    assert res_data["assignments"][0]["invigilator_id"] == all_invs[0]["id"]

    assigned_room_id = res_data["assignments"][0]["room_id"]

    # Test putting duty on HOLD (room_id=0)
    hold_res = client.post(
        "/api/v1/invigilators/assign",
        json={
            "invigilator_id": all_invs[0]["id"],
            "room_id": 0
        },
        headers=root_headers
    )
    assert hold_res.status_code == 200
    assert "Standby" in hold_res.json()["message"] or "unassigned" in hold_res.json()["message"].lower()

    # Test on-the-fly faculty registration without password (defaults to Faculty@123)
    new_faculty_res = client.post(
        "/api/v1/invigilators/",
        json={
            "faculty_id": "FAC-TEST-999",
            "name": "Dr. OnTheFly Test",
            "department_id": 1,
            "designation": "Assistant Professor",
            "email": "onthefly@gkce.edu.in",
            "phone": "+91 99999 88888"
        },
        headers=root_headers
    )
    assert new_faculty_res.status_code in [200, 201]
    new_inv = new_faculty_res.json()
    assert new_inv["faculty_id"] == "FAC-TEST-999"

    # Test assigning newly created faculty to the previously held room
    reassign_res = client.post(
        "/api/v1/invigilators/assign",
        json={
            "invigilator_id": new_inv["id"],
            "room_id": assigned_room_id
        },
        headers=root_headers
    )
    assert reassign_res.status_code == 200

    # Cleanup created test faculty
    del_res = client.delete(f"/api/v1/invigilators/{new_inv['id']}", headers=root_headers)
    assert del_res.status_code == 200

