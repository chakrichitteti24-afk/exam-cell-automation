import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.exam import Exam
from app.models.infrastructure import Room, Bench, Seat
from app.models.academic import Student, Department
from app.models.seating import StudentAllocation
from app.algorithms.seating_engine import SeatingEngine

def test_mid_examination_two_students_per_bench():
    db = SessionLocal()
    try:
        room_101 = db.execute(select(Room).where(Room.room_number == '101')).scalar_one()
        room_102 = db.execute(select(Room).where(Room.room_number == '102')).scalar_one()
        exam_mid = db.execute(select(Exam).where(Exam.subject_code == 'MAT301')).scalar_one()
        assert exam_mid.exam_type == 'MID'

        engine = SeatingEngine(db)
        summary = engine.run_allocation(
            exam_id=exam_mid.id,
            room_ids=[room_101.id, room_102.id],
            exam_type='MID'
        )

        assert summary.exam_type == 'MID'
        assert summary.seats_per_bench == 2
        assert summary.details_by_room.get('Room 101') == 48

        benches = db.execute(
            select(Bench).where(Bench.room_id == room_101.id).order_by(Bench.bench_number)
        ).scalars().all()
        assert len(benches) == 24

        for b in benches:
            seats = db.execute(
                select(Seat).where(Seat.bench_id == b.id).order_by(Seat.seat_number)
            ).scalars().all()
            assert len(seats) == 2

            alloc1 = db.execute(
                select(StudentAllocation).where(
                    StudentAllocation.exam_id == exam_mid.id,
                    StudentAllocation.seat_id == seats[0].id
                )
            ).scalar_one_or_none()
            alloc2 = db.execute(
                select(StudentAllocation).where(
                    StudentAllocation.exam_id == exam_mid.id,
                    StudentAllocation.seat_id == seats[1].id
                )
            ).scalar_one_or_none()

            assert alloc1 is not None, f'MID Exam: Seat 1 on Bench {b.bench_number} must be allocated'
            assert alloc2 is not None, f'MID Exam: Seat 2 on Bench {b.bench_number} must be allocated'

            st1 = db.execute(select(Student).where(Student.id == alloc1.student_id)).scalar_one()
            st2 = db.execute(select(Student).where(Student.id == alloc2.student_id)).scalar_one()
            assert st1.department_id != st2.department_id, f'MID Exam: Bench {b.bench_number} must have students from distinct branches'

    finally:
        db.close()


def test_sem_examination_one_student_per_bench():
    db = SessionLocal()
    try:
        rooms = db.execute(select(Room).order_by(Room.room_number)).scalars().all()
        room_ids = [r.id for r in rooms]
        assert len(room_ids) >= 4

        exam_sem = db.execute(select(Exam).where(Exam.subject_code == 'MAT302')).scalar_one()
        assert exam_sem.exam_type == 'SEM'

        engine = SeatingEngine(db)
        summary = engine.run_allocation(
            exam_id=exam_sem.id,
            room_ids=room_ids,
            exam_type='SEM'
        )

        assert summary.exam_type == 'SEM'
        assert summary.seats_per_bench == 1
        assert summary.total_students_allocated == 96
        assert summary.rooms_utilized == 4

        for r in rooms:
            count = summary.details_by_room.get(f'Room {r.room_number}', 0)
            assert count == 24, f'SEM Exam: Room {r.room_number} must have exactly 24 candidates (1 per bench)'

        room_101 = [r for r in rooms if r.room_number == '101'][0]
        benches = db.execute(
            select(Bench).where(Bench.room_id == room_101.id).order_by(Bench.col_index, Bench.row_index)
        ).scalars().all()
        assert len(benches) == 24

        last_dept_id = None
        for b in benches:
            seats = db.execute(
                select(Seat).where(Seat.bench_id == b.id).order_by(Seat.seat_number)
            ).scalars().all()
            assert len(seats) == 2

            alloc1 = db.execute(
                select(StudentAllocation).where(
                    StudentAllocation.exam_id == exam_sem.id,
                    StudentAllocation.seat_id == seats[0].id
                )
            ).scalar_one_or_none()
            assert alloc1 is not None, f'SEM Exam: Bench {b.bench_number} Seat 1 must be allocated'

            alloc2 = db.execute(
                select(StudentAllocation).where(
                    StudentAllocation.exam_id == exam_sem.id,
                    StudentAllocation.seat_id == seats[1].id
                )
            ).scalar_one_or_none()
            assert alloc2 is None, f'SEM Exam: Bench {b.bench_number} Seat 2 must remain EMPTY (1 student per bench policy)'

            st1 = db.execute(select(Student).where(Student.id == alloc1.student_id)).scalar_one()
            if last_dept_id is not None:
                assert st1.department_id != last_dept_id, 'SEM Exam: Consecutive benches should alternate departments'
            last_dept_id = st1.department_id

    finally:
        db.close()


def test_exam_subdivisions_mid_and_sem():
    db = SessionLocal()
    try:
        room_101 = db.execute(select(Room).where(Room.room_number == '101')).scalar_one()
        room_102 = db.execute(select(Room).where(Room.room_number == '102')).scalar_one()
        exam_mid = db.execute(select(Exam).where(Exam.subject_code == 'MAT301')).scalar_one()
        exam_sem = db.execute(select(Exam).where(Exam.subject_code == 'MAT302')).scalar_one()

        engine = SeatingEngine(db)

        # 1. Test Mid-1 subdivision (MID_1)
        summary_mid1 = engine.run_allocation(
            exam_id=exam_mid.id,
            room_ids=[room_101.id, room_102.id],
            exam_type='MID',
            exam_subdivision='MID_1'
        )
        assert summary_mid1.exam_type == 'MID'
        assert summary_mid1.exam_subdivision == 'MID_1'
        assert summary_mid1.seats_per_bench == 2

        # 2. Test Mid-2 subdivision (MID_2)
        summary_mid2 = engine.run_allocation(
            exam_id=exam_mid.id,
            room_ids=[room_101.id, room_102.id],
            exam_type='MID',
            exam_subdivision='MID_2'
        )
        assert summary_mid2.exam_type == 'MID'
        assert summary_mid2.exam_subdivision == 'MID_2'
        assert summary_mid2.seats_per_bench == 2

        # 3. Test Semester Regular subdivision (REGULAR)
        rooms = db.execute(select(Room).order_by(Room.room_number)).scalars().all()
        summary_sem_reg = engine.run_allocation(
            exam_id=exam_sem.id,
            room_ids=[r.id for r in rooms],
            exam_type='SEM',
            exam_subdivision='REGULAR'
        )
        assert summary_sem_reg.exam_type == 'SEM'
        assert summary_sem_reg.exam_subdivision == 'REGULAR'
        assert summary_sem_reg.seats_per_bench == 1

        # 4. Test Semester Supplementary subdivision (SUPPLEMENTARY)
        summary_sem_sup = engine.run_allocation(
            exam_id=exam_sem.id,
            room_ids=[r.id for r in rooms],
            exam_type='SEM',
            exam_subdivision='SUPPLEMENTARY'
        )
        assert summary_sem_sup.exam_type == 'SEM'
        assert summary_sem_sup.exam_subdivision == 'SUPPLEMENTARY'
        assert summary_sem_sup.seats_per_bench == 1

    finally:
        db.close()
