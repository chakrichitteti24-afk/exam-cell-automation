from typing import List
from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    subject_code: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # e.g. MAT301
    subject_name: Mapped[str] = mapped_column(String(255), nullable=False) # e.g. Mathematics - III
    exam_type: Mapped[str] = mapped_column(String(50), default="MID") # MID (2 per bench) or SEM (1 per bench)
    exam_subdivision: Mapped[str] = mapped_column(String(50), default="MID_1") # MID_1, MID_2 for MID; REGULAR, SUPPLEMENTARY for SEM
    exam_date: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. 2026-09-15
    start_time: Mapped[str] = mapped_column(String(50), default="10:00 AM")
    end_time: Mapped[str] = mapped_column(String(50), default="01:00 PM")
    session: Mapped[str] = mapped_column(String(50), default="Morning (FN)")
    academic_year: Mapped[str] = mapped_column(String(50), default="2026-2027")
    semester: Mapped[int] = mapped_column(Integer, default=5)
    status: Mapped[str] = mapped_column(String(50), default="SCHEDULED") # SCHEDULED, ACTIVE, COMPLETED

    # Relationships
    registered_students: Mapped[List["ExamStudent"]] = relationship("ExamStudent", back_populates="exam", cascade="all, delete-orphan")
    student_allocations: Mapped[List["StudentAllocation"]] = relationship("StudentAllocation", back_populates="exam", cascade="all, delete-orphan")
    invigilator_allocations: Mapped[List["InvigilatorAllocation"]] = relationship("InvigilatorAllocation", back_populates="exam", cascade="all, delete-orphan")

class ExamStudent(Base):
    __tablename__ = "exam_students"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_exam_student"),
    )

    # Relationships
    exam: Mapped["Exam"] = relationship("Exam", back_populates="registered_students")
    student: Mapped["Student"] = relationship("Student", back_populates="exam_registrations")
