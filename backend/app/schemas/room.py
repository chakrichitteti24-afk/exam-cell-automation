from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class RoomBase(BaseModel):
    room_number: str
    block: str = "Block A"
    floor: str = "1st Floor"
    total_benches: int = 24
    seats_per_bench: int = 2
    capacity: int = 48
    status: str = "AVAILABLE"

class RoomCreate(RoomBase):
    pass

class RoomUpdate(BaseModel):
    block: Optional[str] = None
    floor: Optional[str] = None
    total_benches: Optional[int] = None
    seats_per_bench: Optional[int] = None
    status: Optional[str] = None

class SeatInfo(BaseModel):
    id: int
    seat_number: int
    seat_label: str
    student_roll: Optional[str] = None
    student_name: Optional[str] = None
    department_code: Optional[str] = None

class BenchInfo(BaseModel):
    id: int
    bench_number: int
    row_index: int
    col_index: int
    seat1: Optional[SeatInfo] = None
    seat2: Optional[SeatInfo] = None

class RoomResponse(RoomBase):
    id: int
    benches_count: int = 24

    model_config = ConfigDict(from_attributes=True)

class RoomLayoutResponse(RoomResponse):
    benches: List[BenchInfo] = []
