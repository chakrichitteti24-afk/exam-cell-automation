import os
import secrets
from typing import List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Gokula Krishna College of Engineering - Exam Cell"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "development")
    
    # JWT Configuration: Enforce strong secret; fallback to secure cryptographically random token in dev
    SECRET_KEY: str = os.environ.get("GKCE_JWT_SECRET", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Optional Bootstrap Administrator Configuration (via environment)
    INITIAL_ADMIN_EMAIL: Optional[str] = os.environ.get("ROOT_ADMIN_EMAIL", None)
    INITIAL_ADMIN_PASSWORD: Optional[str] = os.environ.get("ROOT_ADMIN_PASSWORD", None)

    # Security Limits
    MAX_UPLOAD_SIZE_MB: int = 5
    LOGIN_RATE_LIMIT_PER_MINUTE: int = 20

    # VAPID Push Configuration
    VAPID_PUBLIC_KEY: str = os.environ.get(
        "VAPID_PUBLIC_KEY",
        "BGRLRqJSrhA3m25HfGogDzaApqqM_oS_TJ5O6YpIMKO2VzesVMI_td9ouf_J2rJupWXb4X3u87R8zyjsqt6HXKE"
    )
    VAPID_PRIVATE_KEY_PATH: str = os.environ.get("VAPID_PRIVATE_KEY_PATH", "private_key.pem")
    VAPID_CLAIMS_SUB: str = os.environ.get("VAPID_CLAIMS_SUB", "mailto:admin@gkce.edu.in")
    
    # Database: Default SQLite for standalone, seamlessly handles Neon PostgreSQL
    _DEFAULT_DB_PATH: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "gkce_exam_cell.db")).replace("\\", "/")
    DATABASE_URL: str = f"sqlite:///{_DEFAULT_DB_PATH}"
    
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v:
            alt = os.environ.get("GKCE_JWT_SECRET") or os.environ.get("SECRET_KEY")
            if alt:
                return alt
            # Generate a secure 256-bit cryptographically strong token for local development
            return secrets.token_urlsafe(32)
        return v

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )

settings = Settings()


