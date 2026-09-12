from typing import List, Optional, Dict
from pydantic import BaseModel

class AllocationGenerateRequest(BaseModel):
    exam_id: Optional[int] = None
    exam_ids: Optional[List[int]] = None
    room_ids: Optional[List[int]] = None
    exam_type: Optional[str] = None # MID (2 per bench) or SEM (1 per bench)
    exam_subdivision: Optional[str] = None # MID_1, MID_2, REGULAR, SUPPLEMENTARY
    strategy: str = "STRICT_ALTERNATE_BRANCH" # STRICT_ALTERNATE_BRANCH
    arrangement_direction: Optional[str] = "COLUMN_WISE" # COLUMN_WISE, ROW_WISE, SNAKE_COLUMN, SNAKE_ROW

class AllocationRunSummary(BaseModel):
    exam_id: Optional[int] = None
    subject_code: str
    exam_type: str = "MID" # MID or SEM
    exam_subdivision: str = "MID_1" # MID_1, MID_2, REGULAR, SUPPLEMENTARY
    seats_per_bench: int = 2 # 2 for MID, 1 for SEM
    total_students_allocated: int
    rooms_utilized: int
    branch_mixing_compliance_percent: float
    violations_count: int
    details_by_room: Dict[str, int]
    arrangement_direction: Optional[str] = "COLUMN_WISE"
    warnings: Optional[List[str]] = []
    question_paper_breakdown: Optional[Dict[str, int]] = None

class SeatStudent(BaseModel):
    student_id: int
    roll_number: str
    name: str
    department_code: str
    seat_id: int
    seat_number: int
    seat_label: str
    attendance_status: str = "PRESENT"
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None

class BenchSeating(BaseModel):
    bench_id: int
    bench_number: int
    row_index: int
    col_index: int
    seat1: Optional[SeatStudent] = None
    seat2: Optional[SeatStudent] = None
    is_mixed_branch: bool = True
    is_sem_single_seater: bool = False

class RoomSeatingMatrixResponse(BaseModel):
    room_id: int
    room_number: str
    block: str
    capacity: int
    exam_type: str = "MID" # MID or SEM
    exam_subdivision: str = "MID_1" # MID_1, MID_2, REGULAR, SUPPLEMENTARY
    seats_per_bench: int = 2 # 2 for MID, 1 for SEM
    allocated_count: int
    benches_count: int
    benches: List[BenchSeating]
    department_breakdown: Dict[str, int]
    mixing_compliance_percent: float
    arrangement_direction: Optional[str] = "COLUMN_WISE"

class StudentDeskSlipResponse(BaseModel):
    student_id: int
    roll_number: str
    student_name: str
    department_code: str
    semester: int
    academic_year: str
    exam_id: int
    subject_code: str
    subject_name: str
    exam_date: str
    exam_type: str = "MID" # MID or SEM
    exam_subdivision: str = "MID_1" # MID_1, MID_2, REGULAR, SUPPLEMENTARY
    time_slot: str
    room_id: int
    room_number: str
    block: str
    floor: Optional[str] = None
    bench_number: int
    seat_number: int
    seat_label: str
    partner_department: Optional[str] = None
    partner_subject_code: Optional[str] = None
    partner_subject_name: Optional[str] = None
    qr_payload: str
    total_benches: Optional[int] = 24
    row_index: Optional[int] = 1
    col_index: Optional[int] = 1

class AttendanceUpdateRequest(BaseModel):
    exam_id: int
    student_id: int
    room_id: int
    status: str # PRESENT, ABSENT, MALPRACTICE

class DoorNoticeStudent(BaseModel):
    seat_number: int
    bench_number: int
    roll_number: str
    name: str
    department: str
    subject_code: Optional[str] = None

class DoorNoticeResponse(BaseModel):
    institution_name: str = "Gokula Krishna College of Engineering"
    exam_title: str
    subject_code: str
    subject_name: str
    exam_date: str
    exam_type: Optional[str] = "MID"
    exam_subdivision: Optional[str] = "MID_1"
    time_slot: str
    room_number: str
    block: str
    total_candidates: int
    benches_used: int
    students: List[DoorNoticeStudent]
    chief_superintendent_signature: str = "Controller of Examinations"
    question_paper_breakdown: Optional[Dict[str, int]] = None
