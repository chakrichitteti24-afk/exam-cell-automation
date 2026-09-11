from typing import List, Optional
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False) # e.g. CSE, ECE
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships
    students: Mapped[List["Student"]] = relationship("Student", back_populates="department")
    invigilators: Mapped[List["Invigilator"]] = relationship("Invigilator", back_populates="department")

class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), unique=True, nullable=True)
    roll_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
    semester: Mapped[int] = mapped_column(Integer, default=5)
    section: Mapped[str] = mapped_column(String(10), default="A")
    academic_year: Mapped[str] = mapped_column(String(50), default="2026-2027")
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), default="")

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="student_profile")
    department: Mapped["Department"] = relationship("Department", back_populates="students")
    allocations: Mapped[List["StudentAllocation"]] = relationship("StudentAllocation", back_populates="student")
    exam_registrations: Mapped[List["ExamStudent"]] = relationship("ExamStudent", back_populates="student")

class Invigilator(Base):
    __tablename__ = "invigilators"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), unique=True, nullable=True)
    faculty_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)
    designation: Mapped[str] = mapped_column(String(100), default="Assistant Professor")
    phone: Mapped[str] = mapped_column(String(50), default="")
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="invigilator_profile")
    department: Mapped["Department"] = relationship("Department", back_populates="invigilators")
    allocations: Mapped[List["InvigilatorAllocation"]] = relationship("InvigilatorAllocation", back_populates="invigilator")
