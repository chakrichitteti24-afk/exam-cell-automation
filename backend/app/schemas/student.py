from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class StudentBase(BaseModel):
    roll_number: str
    name: str
    department_id: int
    semester: int = 5
    section: str = "A"
    academic_year: str = "2026-2027"
    email: str
    phone: Optional[str] = None

class StudentCreate(StudentBase):
    password: Optional[str] = None

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    semester: Optional[int] = None
    section: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class StudentResponse(StudentBase):
    id: int
    user_id: Optional[int] = None
    department_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ImportedCredential(BaseModel):
    roll_number: str
    email: str
    temp_password: str

class StudentImportSummary(BaseModel):
    total_records: int
    imported_count: int
    skipped_count: int
    errors: list[str] = []
    credentials: List[ImportedCredential] = []

class DepartmentResponse(BaseModel):
    id: int
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)
