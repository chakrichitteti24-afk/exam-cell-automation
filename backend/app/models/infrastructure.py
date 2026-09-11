from typing import List, Optional
from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    room_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False) # e.g. "101"
    block: Mapped[str] = mapped_column(String(50), default="Block A")
    floor: Mapped[str] = mapped_column(String(50), default="1st Floor")
    total_benches: Mapped[int] = mapped_column(Integer, default=24)
    seats_per_bench: Mapped[int] = mapped_column(Integer, default=2)
    capacity: Mapped[int] = mapped_column(Integer, default=48)
    status: Mapped[str] = mapped_column(String(50), default="AVAILABLE")

    # Relationships
    benches: Mapped[List["Bench"]] = relationship("Bench", back_populates="room", cascade="all, delete-orphan")
    invigilator_allocations: Mapped[List["InvigilatorAllocation"]] = relationship("InvigilatorAllocation", back_populates="room")
    student_allocations: Mapped[List["StudentAllocation"]] = relationship("StudentAllocation", back_populates="room")

class Bench(Base):
    __tablename__ = "benches"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    bench_number: Mapped[int] = mapped_column(Integer, nullable=False) # 1 to 24
    row_index: Mapped[int] = mapped_column(Integer, default=1)
    col_index: Mapped[int] = mapped_column(Integer, default=1)

    __table_args__ = (
        UniqueConstraint("room_id", "bench_number", name="uq_room_bench"),
    )

    # Relationships
    room: Mapped["Room"] = relationship("Room", back_populates="benches")
    seats: Mapped[List["Seat"]] = relationship("Seat", back_populates="bench", cascade="all, delete-orphan")

class Seat(Base):
    __tablename__ = "seats"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    bench_id: Mapped[int] = mapped_column(ForeignKey("benches.id"), nullable=False)
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False) # 1 or 2
    seat_label: Mapped[str] = mapped_column(String(50), default="Seat 01")

    __table_args__ = (
        UniqueConstraint("bench_id", "seat_number", name="uq_bench_seat"),
    )

    # Relationships
    bench: Mapped["Bench"] = relationship("Bench", back_populates="seats")
    student_allocation: Mapped[Optional["StudentAllocation"]] = relationship("StudentAllocation", back_populates="seat", uselist=False)
