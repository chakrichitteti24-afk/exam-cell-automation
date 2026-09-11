import pytest
import sys
import os
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

client = TestClient(app)

def get_token(identifier: str, password: str):
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": identifier, "password": password}
    )
    assert response.status_code == 200, f"Login failed for {identifier}: {response.text}"
    return response.json()["access_token"]

def test_auth_login_all_roles():
    """
    Test authentication across all 3 roles:
    1. ROOT: admin@gkce.edu.in / Admin@123
    2. INVIGILATOR: prof.sharma@gkce.edu.in / Faculty@123
    3. STUDENT: 23CS042 / Student@123
    """
    # 1. Root
    root_token = get_token("admin@gkce.edu.in", "Admin@123")
    assert root_token is not None

    # 2. Invigilator
    inv_token = get_token("prof.sharma@gkce.edu.in", "Faculty@123")
    assert inv_token is not None

    # 3. Student
    student_token = get_token("23CS042", "Student@123")
    assert student_token is not None

def test_initial_state_allocation_is_null_and_auto_allots_on_generate():
    """
    Validates:
    1. Initially or when reset, seat allotment is NULL (total_students_allocated == 0).
    2. Student gets 404 (No active seating allocation found).
    3. When ROOT executes SeatingEngine, all candidates are automatically allotted.
    4. Student immediately can retrieve their digital desk slip.
    """
    root_token = get_token("admin@gkce.edu.in", "Admin@123")
    student_token = get_token("23CS042", "Student@123")
    root_headers = {"Authorization": f"Bearer {root_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 1. Reset all allocations to NULL
    reset_res = client.delete("/api/v1/allocation/reset", headers=root_headers)
    assert reset_res.status_code == 200

    # 2. Check summary shows 0 allocations (NULL state)
    sum_res = client.get("/api/v1/allocation/summary", headers=root_headers)
    assert sum_res.status_code == 200
    assert sum_res.json()["total_students_allocated"] == 0
    assert sum_res.json()["branch_mixing_compliance_percent"] == 0.0

    # 3. Student desk slip returns 404 when allocation is NULL
    st_res = client.get("/api/v1/allocation/student/me", headers=student_headers)
    assert st_res.status_code == 404

    # 4. ROOT runs SeatingEngine (Auto-Allot Seats)
    gen_res = client.post(
        "/api/v1/allocation/generate",
        json={
            "exam_id": 1,
            "room_ids": [1, 2],
            "strategy": "MULTI_BRANCH_MIXING",
            "arrangement_direction": "COLUMN_WISE"
        },
        headers=root_headers
    )
    assert gen_res.status_code == 200
    gen_data = gen_res.json()
    assert gen_data["total_students_allocated"] == 96
    assert gen_data["branch_mixing_compliance_percent"] == 100.0

    # 5. Check summary now shows 96 allocations
    sum_after = client.get("/api/v1/allocation/summary", headers=root_headers)
    assert sum_after.status_code == 200
    assert sum_after.json()["total_students_allocated"] == 96

    # 6. Student now gets their desk slip
    st_after = client.get("/api/v1/allocation/student/me", headers=student_headers)
    assert st_after.status_code == 200
    assert st_after.json()["bench_number"] is not None

def test_student_desk_slip_and_isolation():
    """
    Test that candidate 23CS042:
    - Successfully retrieves digital desk slip showing:
      Room 101, Block A, Bench 12, Seat 01, Aarav Patel, CSE, partner ECE.
    - Gets 403 Forbidden when attempting to access Root endpoints (/api/v1/students).
    """
    student_token = get_token("23CS042", "Student@123")
    headers = {"Authorization": f"Bearer {student_token}"}

    # 1. Fetch Desk Slip
    res = client.get("/api/v1/allocation/student/me", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["roll_number"] == "23CS042"
    assert data["student_name"] == "Aarav Patel"
    assert data["department_code"] == "CSE"
    assert data["room_number"] is not None
    assert data["bench_number"] is not None
    assert data["seat_number"] is not None
    assert data["partner_department"] is not None
    assert "GKCE-HALLTICKET:23CS042:MAT301:" in data["qr_payload"]

    # 2. Attempt unauthorized access to Root endpoint
    forbidden_res = client.get("/api/v1/students", headers=headers)
    assert forbidden_res.status_code == 403, "Student must be blocked with 403 Forbidden from accessing student management."

def test_invigilator_sandboxing():
    """
    Test that Invigilator Dr. Sharma:
    - CAN access assigned Room 101 seating grid.
    - CANNOT access Room 102 (gets 403 Forbidden).
    - CAN mark attendance in Room 101.
    """
    inv_token = get_token("prof.sharma@gkce.edu.in", "Faculty@123")
    headers = {"Authorization": f"Bearer {inv_token}"}

    # 1. Fetch Room 101 seating matrix (Assigned room -> 200 OK)
    res_101 = client.get("/api/v1/allocation/room/1/exam/1", headers=headers)
    assert res_101.status_code == 200, res_101.text
    data_101 = res_101.json()
    assert data_101["room_number"] == "101"
    assert data_101["allocated_count"] == 48
    assert data_101["mixing_compliance_percent"] == 100.0

    # 2. Fetch Room 102 seating matrix (Unassigned room -> 403 Forbidden)
    res_102 = client.get("/api/v1/allocation/room/2/exam/1", headers=headers)
    assert res_102.status_code == 403, f"Invigilator must be blocked from unassigned room: {res_102.text}"

    # 3. Mark attendance in Room 101 (Seat 1 candidate)
    bench_1_seat1 = data_101["benches"][0]["seat1"]
    student_id = bench_1_seat1["student_id"]

    att_res = client.post(
        "/api/v1/attendance/mark",
        json={
            "exam_id": 1,
            "room_id": 1,
            "student_id": student_id,
            "status": "PRESENT"
        },
        headers=headers
    )
    assert att_res.status_code == 200, att_res.text
    assert att_res.json()["success"] is True

def test_strict_resource_authorization_no_data_leakage():
    """
    Validates:
    1. Invigilator can access door notice for assigned Room 1, but is strictly blocked (403) from Room 2.
    2. Invigilator can access attendance summary for assigned Room 1, but is blocked (403) from Room 2.
    3. Invigilator can access room layout for assigned Room 1, but is blocked (403) from Room 2.
    4. Invigilator is blocked (403) from Root-only global summary (/api/v1/allocation/summary).
    5. Root can access all rooms and global summary.
    """
    inv_token = get_token("prof.sharma@gkce.edu.in", "Faculty@123")
    inv_headers = {"Authorization": f"Bearer {inv_token}"}

    root_token = get_token("admin@gkce.edu.in", "Admin@123")
    root_headers = {"Authorization": f"Bearer {root_token}"}

    # 1. Door Notice: assigned vs unassigned
    dn_assigned = client.get("/api/v1/allocation/reports/door-notice/1/exam/1", headers=inv_headers)
    assert dn_assigned.status_code == 200, dn_assigned.text

    dn_unassigned = client.get("/api/v1/allocation/reports/door-notice/2/exam/1", headers=inv_headers)
    assert dn_unassigned.status_code == 403, "Invigilator must be blocked from unassigned room door notice"

    # 2. Attendance Summary: assigned vs unassigned
    att_assigned = client.get("/api/v1/attendance/exam/1/room/1", headers=inv_headers)
    assert att_assigned.status_code == 200, att_assigned.text

    att_unassigned = client.get("/api/v1/attendance/exam/1/room/2", headers=inv_headers)
    assert att_unassigned.status_code == 403, "Invigilator must be blocked from unassigned room attendance summary"

    # 3. Room Layout: assigned vs unassigned
    layout_assigned = client.get("/api/v1/rooms/1", headers=inv_headers)
    assert layout_assigned.status_code == 200, layout_assigned.text

    layout_unassigned = client.get("/api/v1/rooms/2", headers=inv_headers)
    assert layout_unassigned.status_code == 403, "Invigilator must be blocked from unassigned room layout"

    # 4. Global summary: Invigilator blocked, Root allowed
    sum_inv = client.get("/api/v1/allocation/summary", headers=inv_headers)
    assert sum_inv.status_code == 403, "Invigilator must be blocked from Root global summary"

    sum_root = client.get("/api/v1/allocation/summary", headers=root_headers)
    assert sum_root.status_code == 200, sum_root.text

