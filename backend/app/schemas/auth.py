from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class LoginRequest(BaseModel):
    identifier: str = Field(..., description="Email, Username, or Student Roll Number")
    password: str = Field(..., min_length=1, description="Password")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    email: str
    full_name: str
    identifier: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    role: str
    full_name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
