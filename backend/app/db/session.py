from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from app.core.config import settings

from sqlalchemy.pool import NullPool

# Common engine kwargs
engine_kwargs = {
    "pool_pre_ping": True,
    "echo": False,
}

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 15}
    engine_kwargs["connect_args"] = connect_args
elif "neon.tech" in settings.DATABASE_URL or "pooler" in settings.DATABASE_URL:
    # Neon Serverless PgBouncer: Use NullPool to avoid stale client connections when Neon scales or cycles sockets
    engine_kwargs["poolclass"] = NullPool
    engine_kwargs["connect_args"] = {
        "connect_timeout": 15,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5
    }
else:
    # High concurrency pooling for standard PostgreSQL
    engine_kwargs["pool_size"] = 15
    engine_kwargs["max_overflow"] = 30
    engine_kwargs["pool_timeout"] = 30
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["connect_args"] = {
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5
    }

# SQLAlchemy 2.0 Engine
engine = create_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

# Enable SQLite Write-Ahead Logging (WAL) for 500+ concurrent users
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.execute("PRAGMA mmap_size=3000000000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
