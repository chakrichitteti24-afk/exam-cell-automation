from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.api.deps import require_role
from app.models.user import User
from app.models.infrastructure import Room, Bench, Seat
from app.models.academic import Invigilator
from app.models.seating import InvigilatorAllocation
from app.schemas.room import RoomCreate, RoomUpdate, RoomResponse, RoomLayoutResponse, BenchInfo, SeatInfo

router = APIRouter()

@router.get("/", response_model=List[RoomResponse])
def list_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT", "INVIGILATOR"]))
):
    """
    List all examination halls.
    """
    rooms = db.execute(select(Room).order_by(Room.room_number)).scalars().all()
    results = []
    for r in rooms:
        benches = db.execute(select(Bench).where(Bench.room_id == r.id)).scalars().all()
        results.append(
            RoomResponse(
                id=r.id,
                room_number=r.room_number,
                block=r.block,
                floor=r.floor,
                total_benches=r.total_benches,
                seats_per_bench=r.seats_per_bench,
                capacity=r.capacity,
                status=r.status,
                benches_count=len(benches)
            )
        )
    return results

@router.get("/{room_id}", response_model=RoomLayoutResponse)
def get_room_layout(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT", "INVIGILATOR"]))
):
    """
    Get full 24-bench layout structure for a specific examination room.
    Enforces strict room sandboxing for invigilators.
    """
    if current_user.role == "INVIGILATOR":
        inv = db.execute(select(Invigilator).where(Invigilator.user_id == current_user.id)).scalar_one_or_none()
        if not inv:
            raise HTTPException(status_code=403, detail="Invigilator profile not found.")
        assignment = db.execute(
            select(InvigilatorAllocation).where(
                InvigilatorAllocation.invigilator_id == inv.id,
                InvigilatorAllocation.room_id == room_id
            )
        ).scalars().first()
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: You are not authorized to view the physical layout of Room ID {room_id}."
            )

    room = db.execute(select(Room).where(Room.id == room_id)).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")

    benches = db.execute(
        select(Bench).where(Bench.room_id == room.id).order_by(Bench.bench_number)
    ).scalars().all()

    bench_infos = []
    for b in benches:
        seats = db.execute(
            select(Seat).where(Seat.bench_id == b.id).order_by(Seat.seat_number)
        ).scalars().all()
        
        s1_info = SeatInfo(id=seats[0].id, seat_number=1, seat_label=seats[0].seat_label) if len(seats) > 0 else None
        s2_info = SeatInfo(id=seats[1].id, seat_number=2, seat_label=seats[1].seat_label) if len(seats) > 1 else None

        bench_infos.append(
            BenchInfo(
                id=b.id,
                bench_number=b.bench_number,
                row_index=b.row_index,
                col_index=b.col_index,
                seat1=s1_info,
                seat2=s2_info
            )
        )

    return RoomLayoutResponse(
        id=room.id,
        room_number=room.room_number,
        block=room.block,
        floor=room.floor,
        total_benches=room.total_benches,
        seats_per_bench=room.seats_per_bench,
        capacity=room.capacity,
        status=room.status,
        benches_count=len(benches),
        benches=bench_infos
    )

@router.post("/", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    payload: RoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Create a new examination hall and automatically generate its 24 benches and 48 seats.
    Restricted to ROOT administrators.
    """
    existing = db.execute(select(Room).where(Room.room_number == payload.room_number)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"Room '{payload.room_number}' already exists.")

    total_benches = payload.total_benches or 24
    seats_per_bench = payload.seats_per_bench or 2
    capacity = total_benches * seats_per_bench

    room = Room(
        room_number=payload.room_number,
        block=payload.block,
        floor=payload.floor,
        total_benches=total_benches,
        seats_per_bench=seats_per_bench,
        capacity=capacity,
        status=payload.status
    )
    db.add(room)
    db.flush()

    # Automatically generate 24 benches arranged in 4 columns × 6 rows
    for bench_num in range(1, total_benches + 1):
        col_idx = ((bench_num - 1) % 4) + 1
        row_idx = ((bench_num - 1) // 4) + 1

        bench = Bench(
            room_id=room.id,
            bench_number=bench_num,
            row_index=row_idx,
            col_index=col_idx
        )
        db.add(bench)
        db.flush()

        # Seat 01 and Seat 02
        seat1 = Seat(bench_id=bench.id, seat_number=1, seat_label="Seat 01")
        seat2 = Seat(bench_id=bench.id, seat_number=2, seat_label="Seat 02")
        db.add_all([seat1, seat2])

    db.commit()
    db.refresh(room)

    return RoomResponse(
        id=room.id,
        room_number=room.room_number,
        block=room.block,
        floor=room.floor,
        total_benches=room.total_benches,
        seats_per_bench=room.seats_per_bench,
        capacity=room.capacity,
        status=room.status,
        benches_count=total_benches
    )
