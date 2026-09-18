from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.academic import Department
from app.schemas.student import DepartmentResponse

router = APIRouter()

@router.get("/", response_model=List[DepartmentResponse])
def list_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all academic departments (CSE, ECE, EEE, MECH, CIVIL).
    Requires authenticated user session.
    """
    depts = db.execute(select(Department).order_by(Department.code)).scalars().all()
    return depts
