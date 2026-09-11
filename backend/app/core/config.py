from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import os
import hashlib
import platform

def _generate_stable_dev_secret() -> str:
    """
    Generate a stable development-only JWT secret derived from the machine's
    hostname and database path. This ensures tokens survive server restarts
    during development, but is NOT suitable for production.
    In production, always set the GKCE_JWT_SECRET environment variable.
    """
    machine_id = f"{platform.node()}:{os.path.dirname(os.path.abspath(__file__))}"
    return hashlib.sha256(machine_id.encode()).hexdigest()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Gokula Krishna College of Engineering - Exam Cell"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.environ.get("GKCE_JWT_SECRET", _generate_stable_dev_secret())
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database: Default SQLite for standalone, seamlessly handles Neon PostgreSQL
    _DEFAULT_DB_PATH: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "gkce_exam_cell.db")).replace("\\", "/")
    DATABASE_URL: str = f"sqlite:///{_DEFAULT_DB_PATH}"
    
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )

settings = Settings()

