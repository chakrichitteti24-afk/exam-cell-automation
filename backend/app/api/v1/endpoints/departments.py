from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.models.academic import Department
from app.schemas.student import DepartmentResponse

router = APIRouter()

@router.get("/", response_model=List[DepartmentResponse])
def list_departments(
    db: Session = Depends(get_db)
):
    """
    List all academic departments (CSE, ECE, EEE, MECH, CIVIL).
    """
    depts = db.execute(select(Department).order_by(Department.code)).scalars().all()
    return depts
