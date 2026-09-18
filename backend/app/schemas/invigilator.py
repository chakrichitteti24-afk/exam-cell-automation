from typing import Optional
from pydantic import BaseModel, ConfigDict

class InvigilatorBase(BaseModel):
    faculty_id: str
    name: str
    department_id: int
    designation: str = "Assistant Professor"
    email: str
    phone: str = "+91 98765 43211"

class InvigilatorCreate(InvigilatorBase):
    password: Optional[str] = None

class InvigilatorResponse(InvigilatorBase):
    id: int
    user_id: Optional[int] = None
    department_code: Optional[str] = None
    assigned_room: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class DutyAssignmentResponse(BaseModel):
    id: int
    exam_id: int
    subject_code: str
    subject_name: str
    exam_date: str
    time_slot: str
    room_id: int
    room_number: str
    block: str
    total_students: int
    present_count: int
    absent_count: int

class DutyAssignRequest(BaseModel):
    invigilator_id: Optional[int] = None
    room_id: Optional[int] = None
    exam_id: Optional[int] = None
    auto_distribute: Optional[bool] = False
    selected_invigilator_ids: Optional[list[int]] = None
    selected_room_ids: Optional[list[int]] = None

class DutyAssignResult(BaseModel):
    message: str
    invigilator_id: Optional[int] = None
    invigilator_name: Optional[str] = None
    room_id: Optional[int] = None
    room_number: Optional[str] = None
    status: Optional[str] = "SUCCESS"
    assignments: Optional[list] = []
    shortage_count: Optional[int] = 0
    unassigned_rooms: Optional[list[str]] = []


