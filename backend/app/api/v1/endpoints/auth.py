from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, or_
from app.db.session import get_db
from app.core.security import verify_password, create_access_token
from app.api.deps import get_current_user
from app.models.user import User
from app.models.academic import Student
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
def login_for_access_token(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate a user (ROOT, INVIGILATOR, or STUDENT) and return a signed JWT.
    Supports login via institutional email, username, or Student roll number.
    """
    clean_id = payload.identifier.strip()
    
    # 1. Search directly in users table by email or username
    user = db.execute(
        select(User).where(
            or_(
                User.email.ilike(clean_id),
                User.username.ilike(clean_id)
            )
        )
    ).scalar_one_or_none()

    # 2. If not found, check if it's a student roll number (e.g. 23CS042)
    if not user:
        student = db.execute(
            select(Student).where(Student.roll_number.ilike(clean_id))
        ).scalar_one_or_none()
        if student and student.user_id:
            user = db.execute(select(User).where(User.id == student.user_id)).scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email/roll number or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email/roll number or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is currently inactive.",
        )

    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        extra_claims={"email": user.email, "role": user.role}
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        identifier=user.username
    )

@router.get("/me", response_model=UserResponse)
def read_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Return the authenticated user's profile.
    """
    return current_user
