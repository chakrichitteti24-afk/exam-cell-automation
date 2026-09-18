from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class StudentAllocation(Base):
    __tablename__ = "student_allocations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False, index=True)
    bench_id: Mapped[int] = mapped_column(ForeignKey("benches.id"), nullable=False, index=True)
    seat_id: Mapped[int] = mapped_column(ForeignKey("seats.id"), nullable=False, index=True)
    allocated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_exam_student_alloc"),
        UniqueConstraint("exam_id", "seat_id", name="uq_exam_seat_alloc"),
    )

    # Relationships
    exam: Mapped["Exam"] = relationship("Exam", back_populates="student_allocations")
    student: Mapped["Student"] = relationship("Student", back_populates="allocations")
    room: Mapped["Room"] = relationship("Room", back_populates="student_allocations")
    bench: Mapped["Bench"] = relationship("Bench")
    seat: Mapped["Seat"] = relationship("Seat", back_populates="student_allocation")

class InvigilatorAllocation(Base):
    __tablename__ = "invigilator_allocations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"), nullable=False, index=True)
    invigilator_id: Mapped[int] = mapped_column(ForeignKey("invigilators.id"), nullable=False, index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False, index=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("exam_id", "room_id", "invigilator_id", name="uq_exam_room_invig"),
    )

    # Relationships
    exam: Mapped["Exam"] = relationship("Exam", back_populates="invigilator_allocations")
    invigilator: Mapped["Invigilator"] = relationship("Invigilator", back_populates="allocations")
    room: Mapped["Room"] = relationship("Room", back_populates="invigilator_allocations")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="PRESENT") # PRESENT, ABSENT, MALPRACTICE
    marked_by_invigilator_id: Mapped[Optional[int]] = mapped_column(ForeignKey("invigilators.id"), nullable=True, index=True)
    marked_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_exam_student_attendance"),
    )

    # Relationships
    exam: Mapped["Exam"] = relationship("Exam")
    student: Mapped["Student"] = relationship("Student")
    room: Mapped["Room"] = relationship("Room")
    invigilator: Mapped[Optional["Invigilator"]] = relationship("Invigilator")
