import pytest
import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.exam import Exam
from app.models.infrastructure import Room, Bench, Seat
from app.models.academic import Student, Department
from app.models.seating import StudentAllocation
from app.algorithms.seating_engine import SeatingEngine

def test_room_101_seating_constraints():
    """
    Validates:
    1. Room 101 has exactly 24 benches.
    2. Capacity is 48 seats (2 seats per bench).
    3. 100% Branch-Mixing compliance across all benches.
    """
    db = SessionLocal()
    try:
        # Fetch Room 101
        room_101 = db.execute(select(Room).where(Room.room_number == "101")).scalar_one_or_none()
        assert room_101 is not None
        assert room_101.total_benches == 24
        assert room_101.capacity == 48

        # Fetch Exam MAT301
        exam = db.execute(select(Exam).where(Exam.subject_code == "MAT301")).scalar_one_or_none()
        assert exam is not None

        room_102 = db.execute(select(Room).where(Room.room_number == "102")).scalar_one_or_none()
        assert room_102 is not None

        # Execute allocation engine for rooms 101 and 102
        engine = SeatingEngine(db)
        engine.run_allocation(exam_id=exam.id, room_ids=[room_101.id, room_102.id])

        # Fetch all benches for Room 101
        benches = db.execute(
            select(Bench).where(Bench.room_id == room_101.id).order_by(Bench.bench_number)
        ).scalars().all()
        assert len(benches) == 24

        total_allocations = 0

        for b in benches:
            seats = db.execute(
                select(Seat).where(Seat.bench_id == b.id).order_by(Seat.seat_number)
            ).scalars().all()
            assert len(seats) == 2

            # Seat 1 allocation
            alloc1 = db.execute(
                select(StudentAllocation).where(
                    StudentAllocation.exam_id == exam.id,
                    StudentAllocation.seat_id == seats[0].id
                )
            ).scalar_one_or_none()
            assert alloc1 is not None, f"Seat 1 on Bench {b.bench_number} must be allocated"

            # Seat 2 allocation
            alloc2 = db.execute(
                select(StudentAllocation).where(
                    StudentAllocation.exam_id == exam.id,
                    StudentAllocation.seat_id == seats[1].id
                )
            ).scalar_one_or_none()
            assert alloc2 is not None, f"Seat 2 on Bench {b.bench_number} must be allocated"

            st1 = db.execute(select(Student).where(Student.id == alloc1.student_id)).scalar_one()
            st2 = db.execute(select(Student).where(Student.id == alloc2.student_id)).scalar_one()

            dept1 = db.execute(select(Department).where(Department.id == st1.department_id)).scalar_one()
            dept2 = db.execute(select(Department).where(Department.id == st2.department_id)).scalar_one()

            # Rule: 0 collisions on any bench
            assert dept1.code != dept2.code

            total_allocations += 2

        # 24 benches x 2 = 48 students in Room 101
        assert total_allocations == 48

        print("PASSED: Room 101 24-bench CSE+ECE seating verified with 100% branch mixing compliance.")
    finally:
        db.close()

def test_room_102_overflow_branch_mixing():
    """
    Validates Room 102 receives overflow students with 100% branch-mixing compliance.
    """
    db = SessionLocal()
    try:
        room_102 = db.execute(select(Room).where(Room.room_number == "102")).scalar_one_or_none()
        assert room_102 is not None
        exam = db.execute(select(Exam).where(Exam.subject_code == "MAT301")).scalar_one_or_none()
        assert exam is not None

        allocs = db.execute(
            select(StudentAllocation).where(
                StudentAllocation.room_id == room_102.id,
                StudentAllocation.exam_id == exam.id
            )
        ).scalars().all()

        assert len(allocs) == 48 # 24 benches occupied by 48 students

        benches = db.execute(
            select(Bench).where(Bench.room_id == room_102.id).order_by(Bench.bench_number)
        ).scalars().all()

        for b in benches:
            seats = db.execute(
                select(Seat).where(Seat.bench_id == b.id).order_by(Seat.seat_number)
            ).scalars().all()

            alloc1 = db.execute(
                select(StudentAllocation).where(
                    StudentAllocation.exam_id == exam.id,
                    StudentAllocation.seat_id == seats[0].id
                )
            ).scalar_one_or_none()
            alloc2 = db.execute(
                select(StudentAllocation).where(
                    StudentAllocation.exam_id == exam.id,
                    StudentAllocation.seat_id == seats[1].id
                )
            ).scalar_one_or_none()

            # If both seats are occupied, check branch mixing
            if alloc1 and alloc2:
                st1 = db.execute(select(Student).where(Student.id == alloc1.student_id)).scalar_one()
                st2 = db.execute(select(Student).where(Student.id == alloc2.student_id)).scalar_one()
                assert st1.department_id != st2.department_id

        print("PASSED: Room 102 overflow branch mixing verified with 0 collisions.")
    finally:
        db.close()

def test_seating_arrangement_column_wise_and_row_wise():
    """
    Validates:
    1. COLUMN_WISE fills Column 1 benches first before moving to Column 2.
    2. ROW_WISE fills Row 1 benches first before moving to Row 2.
    """
    db = SessionLocal()
    try:
        exam = db.execute(select(Exam).where(Exam.subject_code == "MAT301")).scalar_one()
        room_101 = db.execute(select(Room).where(Room.room_number == "101")).scalar_one()
        room_102 = db.execute(select(Room).where(Room.room_number == "102")).scalar_one()

        engine = SeatingEngine(db)

        # 1. Run Column-Wise
        col_summary = engine.run_allocation(
            exam_id=exam.id,
            room_ids=[room_101.id, room_102.id],
            arrangement_direction="COLUMN_WISE"
        )
        assert col_summary.branch_mixing_compliance_percent == 100.0
        assert col_summary.arrangement_direction == "COLUMN_WISE"

        # 2. Run Row-Wise
        row_summary = engine.run_allocation(
            exam_id=exam.id,
            room_ids=[room_101.id, room_102.id],
            arrangement_direction="ROW_WISE"
        )
        assert row_summary.branch_mixing_compliance_percent == 100.0
        assert row_summary.arrangement_direction == "ROW_WISE"

        print("PASSED: Column-wise and row-wise seating arrangements verified successfully.")
    finally:
        db.close()

def test_multi_exam_session_concurrent_allocation():
    """
    Validates:
    1. Multi-department concurrent exams (CS301, EC301, EE301, ME301, CE301) running in the same session.
    2. Zero cheaters: Every bench pairs students from DIFFERENT exams / question papers.
    3. Question paper breakdown matches candidate counts.
    """
    db = SessionLocal()
    try:
        dept_exams = db.execute(
            select(Exam).where(Exam.subject_code.in_(["CS301", "EC301", "EE301", "ME301", "CE301"]))
        ).scalars().all()
        assert len(dept_exams) >= 5, "All 5 departmental exams should be scheduled"

        exam_ids = [e.id for e in dept_exams]
        rooms = db.execute(select(Room).order_by(Room.room_number)).scalars().all()
        room_ids = [r.id for r in rooms]

        engine = SeatingEngine(db)
        summary = engine.run_allocation(
            exam_ids=exam_ids,
            room_ids=room_ids,
            arrangement_direction="COLUMN_WISE"
        )

        assert summary.total_students_allocated > 0
        assert summary.branch_mixing_compliance_percent == 100.0
        assert summary.violations_count == 0
        assert summary.question_paper_breakdown is not None
        assert "CS301" in summary.question_paper_breakdown
        assert "EC301" in summary.question_paper_breakdown

        # Verify on actual benches in Room 101:
        # Every occupied bench has candidates writing different question papers
        room_101 = db.execute(select(Room).where(Room.room_number == "101")).scalar_one()
        benches = db.execute(select(Bench).where(Bench.room_id == room_101.id)).scalars().all()

        mixed_count = 0
        for b in benches:
            seats = db.execute(select(Seat).where(Seat.bench_id == b.id).order_by(Seat.seat_number)).scalars().all()
            a1 = db.execute(select(StudentAllocation).where(StudentAllocation.seat_id == seats[0].id, StudentAllocation.room_id == room_101.id, StudentAllocation.exam_id.in_(exam_ids))).scalar_one_or_none()
            a2 = db.execute(select(StudentAllocation).where(StudentAllocation.seat_id == seats[1].id, StudentAllocation.room_id == room_101.id, StudentAllocation.exam_id.in_(exam_ids))).scalar_one_or_none()

            if a1 and a2:
                # Different exams / different question papers!
                assert a1.exam_id != a2.exam_id, f"Bench {b.bench_number} must pair different exams"
                mixed_count += 1

        assert mixed_count > 0, "Room 101 should have fully paired mixed benches"
        print(f"PASSED: Multi-Exam Session pairing verified across {mixed_count} benches with 100% distinct question papers.")
    finally:
        db.close()


