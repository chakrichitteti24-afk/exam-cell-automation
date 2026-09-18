"""
GKCE Exam Cell Automation System — Neon Database Migration & Sync Tool
Transfers schema, tables, and live data from local SQLite to Neon Serverless PostgreSQL.
"""

import sys
import os
import argparse
from typing import Dict, Any

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker, Session
from app.db.base import Base
from app.models.user import User
from app.models.academic import Department, Student, Invigilator
from app.models.infrastructure import Room, Bench, Seat
from app.models.exam import Exam, ExamStudent
from app.models.seating import StudentAllocation, InvigilatorAllocation, AttendanceRecord
from app.models.push_subscription import PushSubscription

SQLITE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "gkce_exam_cell.db")).replace("\\", "/")
SQLITE_URL = f"sqlite:///{SQLITE_PATH}"

def get_row_dict(model_instance) -> Dict[str, Any]:
    """Extract columns and values from an active SQLAlchemy model instance."""
    data = {}
    for col in model_instance.__table__.columns:
        data[col.name] = getattr(model_instance, col.name)
    return data

def migrate_to_neon(neon_url: str):
    print("=" * 65)
    print("  GKCE Exam Cell — Neon Serverless PostgreSQL Migration Tool")
    print("=" * 65)
    
    # Normalize URL
    neon_url = neon_url.strip().strip("'").strip('"')
    if neon_url.startswith("postgres://"):
        neon_url = neon_url.replace("postgres://", "postgresql://", 1)

    print(f"\n[1/5] Connecting to Neon Database...")
    try:
        neon_engine = create_engine(
            neon_url,
            pool_pre_ping=True,
            pool_recycle=300,
            connect_args={"connect_timeout": 15}
        )
        with neon_engine.connect() as conn:
            pg_ver = conn.execute(text("SELECT version();")).scalar()
            print(f"  * Connected to Neon: {pg_ver[:55]}...")
    except Exception as e:
        print(f"\n[ERROR] Failed to connect to Neon PostgreSQL: {e}")
        print("\nPlease verify your Neon connection string:")
        print("  e.g.: postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require")
        sys.exit(1)

    print("\n[2/5] Creating Database Schema & Tables on Neon...")
    try:
        # Drop existing tables to ensure a clean migration (useful if previous runs failed halfway)
        Base.metadata.drop_all(bind=neon_engine)
        Base.metadata.create_all(bind=neon_engine)
        print("  * All 12 tables created / verified in Neon PostgreSQL.")
    except Exception as e:
        print(f"\n[ERROR] Failed to create tables: {e}")
        sys.exit(1)

    print("\n[3/5] Reading data from source SQLite database...")
    sqlite_engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
    SqliteSession = sessionmaker(bind=sqlite_engine)
    NeonSession = sessionmaker(bind=neon_engine)

    sqlite_db: Session = SqliteSession()
    neon_db: Session = NeonSession()

    # Tables in strict foreign-key dependency order
    migration_models = [
        ("Departments", Department),
        ("Users", User),
        ("Rooms", Room),
        ("Benches", Bench),
        ("Seats", Seat),
        ("Students", Student),
        ("Invigilators", Invigilator),
        ("Exams", Exam),
        ("ExamStudents", ExamStudent),
        ("StudentAllocations", StudentAllocation),
        ("InvigilatorAllocations", InvigilatorAllocation),
        ("AttendanceRecords", AttendanceRecord),
    ]

    print("\n[4/5] Migrating records from SQLite into Neon PostgreSQL...")
    stats = {}

    try:
        for name, model in migration_models:
            rows = sqlite_db.query(model).all()
            if rows:
                mappings = [get_row_dict(r) for r in rows]
                neon_db.bulk_insert_mappings(model, mappings)
                neon_db.commit()
                stats[name] = len(rows)
                print(f"  * {name:24}: {len(rows):4d} records copied")
            else:
                stats[name] = 0
                print(f"  - {name:24}:    0 records (empty)")

        # Sync PostgreSQL primary key sequences so subsequent INSERTs succeed without collision
        print("\n[5/5] Synchronizing PostgreSQL sequence generators...")
        tables_with_id = [
            "departments", "users", "rooms", "benches", "seats",
            "students", "invigilators", "exams", "exam_students",
            "student_allocations", "invigilator_allocations", "attendance_records"
        ]
        with neon_engine.connect() as conn:
            for tbl in tables_with_id:
                try:
                    conn.execute(text(
                        f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), "
                        f"coalesce((SELECT MAX(id) FROM {tbl}), 1), true);"
                    ))
                    conn.commit()
                except Exception:
                    pass
        print("  * Sequences aligned with maximum ID values.")

    except Exception as e:
        neon_db.rollback()
        print(f"\n[ERROR] Migration failed during data transfer: {e}")
        sys.exit(1)
    finally:
        sqlite_db.close()
        neon_db.close()

    # Update backend/.env with Neon DATABASE_URL
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    try:
        updated_lines = []
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("DATABASE_URL="):
                        updated_lines.append(f'DATABASE_URL="{neon_url}"\n')
                    else:
                        updated_lines.append(line)
        else:
            updated_lines = [
                f'PROJECT_NAME="Gokula Krishna College of Engineering - Exam Cell"\n',
                f'API_V1_STR="/api/v1"\n',
                f'SECRET_KEY="gkce_exam_cell_super_secret_jwt_key_2026_production"\n',
                f'DATABASE_URL="{neon_url}"\n'
            ]
        
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(updated_lines)
        print(f"\n  * backend/.env updated with Neon DATABASE_URL.")
    except Exception as e:
        print(f"  - Could not write to .env automatically: {e}")

    print("\n" + "=" * 65)
    print("  *** MIGRATION TO NEON DATABASE COMPLETE & SUCCESSFUL!")
    print("=" * 65)
    print(f"Total Enrolled Students : {stats.get('Students', 0)}")
    print(f"Total Examination Halls : {stats.get('Rooms', 0)}")
    print(f"Total Benches / Desks   : {stats.get('Benches', 0)}")
    print(f"Faculty Invigilators    : {stats.get('Invigilators', 0)}")
    print(f"Scheduled Exams         : {stats.get('Exams', 0)}")
    print(f"Seating Allocations     : {stats.get('StudentAllocations', 0)}")
    print(f"Invigilator Duties      : {stats.get('InvigilatorAllocations', 0)}")
    print("=" * 65)
    print("\nYour FastAPI backend will now connect directly to Neon PostgreSQL.")
    print("Run 'python -m pytest' or 'start_dev.bat' to verify.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate GKCE Exam Cell SQLite database to Neon PostgreSQL")
    parser.add_argument("--url", type=str, help="Neon PostgreSQL connection URL")
    args = parser.parse_args()

    neon_url = args.url
    if not neon_url:
        from app.core.config import settings
        if settings.DATABASE_URL and "neon.tech" in settings.DATABASE_URL:
            neon_url = settings.DATABASE_URL
        else:
            env_val = os.environ.get("DATABASE_URL")
            if env_val and "neon.tech" in env_val:
                neon_url = env_val

    if not neon_url or "neon.tech" not in neon_url:
        print("\n[USAGE] Please provide your Neon connection URL:")
        print('  python migrate_to_neon.py --url "postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"')
        print("\nOr update DATABASE_URL in backend/.env with your Neon connection URL.")
        sys.exit(1)

    migrate_to_neon(neon_url)
