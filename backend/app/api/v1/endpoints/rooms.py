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
    
    from sqlalchemy import func
    bench_data = db.execute(
        select(Bench.room_id, func.count(Bench.id)).group_by(Bench.room_id)
    ).all()
    bench_map = {row[0]: row[1] for row in bench_data}

    results = []
    for r in rooms:
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
                benches_count=bench_map.get(r.id, 0)
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
    bench_ids = [b.id for b in benches]

    # Pre-fetch all seats for these benches
    all_seats = []
    if bench_ids:
        all_seats = db.execute(
            select(Seat).where(Seat.bench_id.in_(bench_ids)).order_by(Seat.bench_id, Seat.seat_number)
        ).scalars().all()
        
    from collections import defaultdict
    seat_map = defaultdict(list)
    for seat in all_seats:
        seat_map[seat.bench_id].append(seat)

    bench_infos = []
    for b in benches:
        seats = seat_map.get(b.id, [])
        
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
    Create a new examination hall and automatically generate its benches and seats.
    Restricted to ROOT administrators.
    """
    room_num = payload.room_number.strip() if payload.room_number else ""
    if not room_num:
        raise HTTPException(status_code=400, detail="Room number is required.")

    existing = db.execute(select(Room).where(Room.room_number == room_num)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"Room '{room_num}' already exists.")

    total_benches = payload.total_benches or 24
    seats_per_bench = payload.seats_per_bench or 2
    capacity = total_benches * seats_per_bench

    floor_str = str(payload.floor).strip() if payload.floor is not None else "1st Floor"
    if floor_str.isdigit():
        n = int(floor_str)
        suffix = "th" if 11 <= (n % 100) <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
        floor_str = f"{n}{suffix} Floor"

    room = Room(
        room_number=room_num,
        block=payload.block.strip() if payload.block else "Block A",
        floor=floor_str,
        total_benches=total_benches,
        seats_per_bench=seats_per_bench,
        capacity=capacity,
        status=payload.status
    )
    db.add(room)
    db.flush()

    # Automatically generate benches arranged in 4 columns × N rows
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

        # Dynamic seats per bench
        for s_num in range(1, seats_per_bench + 1):
            seat = Seat(bench_id=bench.id, seat_number=s_num, seat_label=f"Seat {s_num:02d}")
            db.add(seat)

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

@router.delete("/{room_id}", status_code=status.HTTP_200_OK)
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ROOT"]))
):
    """
    Permanently delete an examination hall, its benches, seats, and associated allocations.
    Restricted to ROOT administrators.
    """
    from sqlalchemy import delete as sql_delete
    from app.models.seating import StudentAllocation, InvigilatorAllocation, AttendanceRecord

    room = db.execute(select(Room).where(Room.id == room_id)).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail=f"Examination hall with ID {room_id} not found.")

    # 1. Clean up active allocations and attendance records linked to this room
    db.execute(sql_delete(AttendanceRecord).where(AttendanceRecord.room_id == room.id))
    db.execute(sql_delete(StudentAllocation).where(StudentAllocation.room_id == room.id))
    db.execute(sql_delete(InvigilatorAllocation).where(InvigilatorAllocation.room_id == room.id))

    # 2. Clean up benches and seats
    benches = db.execute(select(Bench).where(Bench.room_id == room.id)).scalars().all()
    bench_ids = [b.id for b in benches]
    if bench_ids:
        db.execute(sql_delete(Seat).where(Seat.bench_id.in_(bench_ids)))
        db.execute(sql_delete(Bench).where(Bench.id.in_(bench_ids)))

    # 3. Delete the room record
    room_number = room.room_number
    db.delete(room)
    db.commit()

    return {"message": f"Examination hall Room {room_number} and all its physical benches have been permanently deleted."}

