from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class ExamBase(BaseModel):
    subject_code: str
    subject_name: str
    exam_date: str
    start_time: str = "10:00 AM"
    end_time: str = "01:00 PM"
    session: str = "Morning (FN)"
    academic_year: str = "2026-2027"
    semester: int = 5
    exam_type: str = "MID" # MID (2 students/bench) or SEM (1 student/bench)
    exam_subdivision: str = "MID_1" # MID_1, MID_2 (for MID) or REGULAR, SUPPLEMENTARY (for SEM)
    status: str = "SCHEDULED"

class ExamCreate(ExamBase):
    eligible_department_ids: Optional[List[int]] = []

class ExamResponse(ExamBase):
    id: int
    enrolled_students_count: int = 0
    allocated_students_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class ExamLaunchRequest(BaseModel):
    exam_id: Optional[int] = None
    exam_ids: Optional[List[int]] = None
    room_ids: Optional[List[int]] = None
    department_codes: Optional[List[str]] = None
    exam_type: Optional[str] = None # MID or SEM (overrides exam setting if provided)
    exam_subdivision: Optional[str] = None # MID_1, MID_2, REGULAR, SUPPLEMENTARY
    strategy: Optional[str] = "MULTI_BRANCH_MIXING"
    arrangement_direction: Optional[str] = "COLUMN_WISE"
    auto_assign_invigilators: Optional[bool] = True

class DutyRosterItem(BaseModel):
    room_id: int
    room_number: str
    block: str
    invigilator_id: int
    invigilator_name: str
    faculty_id: str
    department_code: str
    total_candidates: int = 0
    is_alternative_fallback: bool = False

class ExamLaunchResponse(BaseModel):
    message: str
    status: str
    launched_exams: List[ExamResponse]
    total_students_allocated: int
    rooms_utilized: int
    branch_mixing_compliance_percent: float
    duty_roster: List[DutyRosterItem]

