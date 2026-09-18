import os
import time
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import create_engine, select, text, inspect
from sqlalchemy.orm import Session
from app.db.session import get_db, engine
from app.core.config import settings
from app.api.deps import require_role
from app.models.user import User
from app.models.academic import Department, Student, Invigilator
from app.models.infrastructure import Room, Bench, Seat
from app.models.exam import Exam, ExamStudent
from app.models.seating import StudentAllocation, InvigilatorAllocation, AttendanceRecord
from app.db.base import Base

router = APIRouter()

class NeonTestPayload(BaseModel):
    neon_url: str

class NeonMigratePayload(BaseModel):
    neon_url: str

@router.get('/status')
def get_system_database_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(['ROOT', 'INVIGILATOR']))
):
    raw_url = str(settings.DATABASE_URL)
    is_neon = 'neon.tech' in raw_url.lower()
    dialect = engine.dialect.name

    if is_neon or dialect == 'postgresql':
        try:
            parts = raw_url.split('@')
            if len(parts) > 1:
                masked_url = 'postgresql://***:***@' + parts[1]
            else:
                masked_url = 'postgresql://***'
        except Exception:
            masked_url = 'postgresql://[configured]'
        db_type = 'Neon Serverless PostgreSQL' if is_neon else 'PostgreSQL'
    else:
        masked_url = 'sqlite:///gkce_exam_cell.db'
        db_type = 'SQLite (Write-Ahead Logging)'

    try:
        t0 = time.time()
        db.execute(text('SELECT 1'))
        latency_ms = round((time.time() - t0) * 1000, 1)
        connected = True
    except Exception:
        connected = False
        latency_ms = -1

    records = {
        'departments': db.query(Department).count(),
        'rooms': db.query(Room).count(),
        'benches': db.query(Bench).count(),
        'students': db.query(Student).count(),
        'invigilators': db.query(Invigilator).count(),
        'exams': db.query(Exam).count(),
        'student_allocations': db.query(StudentAllocation).count(),
        'invigilator_allocations': db.query(InvigilatorAllocation).count(),
    }

    return {
        'database_type': db_type,
        'dialect': dialect,
        'is_neon': is_neon,
        'is_connected': connected,
        'latency_ms': latency_ms,
        'connection_url': masked_url,
        'records_summary': records,
        'active_pool_size': getattr(engine.pool, 'size', lambda: 1)() if hasattr(engine, 'pool') else 1,
    }

@router.post('/test-neon')
def test_neon_connection(
    payload: NeonTestPayload,
    current_user: User = Depends(require_role(['ROOT']))
):
    url = payload.neon_url.strip().strip("'").strip('"')
    if not url:
        raise HTTPException(status_code=400, detail='Neon connection URL cannot be empty.')

    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)

    t0 = time.time()
    try:
        test_engine = create_engine(
            url,
            pool_pre_ping=True,
            connect_args={'connect_timeout': 10}
        )
        with test_engine.connect() as conn:
            version_str = conn.execute(text('SELECT version();')).scalar()
            inspector = inspect(test_engine)
            existing_tables = inspector.get_table_names()

        latency_ms = round((time.time() - t0) * 1000, 1)

        return {
            'success': True,
            'message': 'Successfully connected to Neon Serverless PostgreSQL!',
            'latency_ms': latency_ms,
            'server_version': (version_str or '')[:60],
            'tables_found': existing_tables,
            'tables_count': len(existing_tables),
            'is_neon': 'neon.tech' in url.lower()
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'Connection failed: {str(e)}',
            'latency_ms': round((time.time() - t0) * 1000, 1),
            'server_version': None,
            'tables_found': [],
            'tables_count': 0,
            'is_neon': 'neon.tech' in url.lower()
        }

@router.post('/migrate-to-neon')
def migrate_data_to_neon(
    payload: NeonMigratePayload,
    current_user: User = Depends(require_role(['ROOT']))
):
    url = payload.neon_url.strip().strip("'").strip('"')
    if not url:
        raise HTTPException(status_code=400, detail='Neon connection URL is required.')

    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)

    from migrate_to_neon import migrate_to_neon
    try:
        migrate_to_neon(url)
        return {
            'success': True,
            'message': 'All tables, records, and sequences migrated to Neon PostgreSQL successfully! Server environment updated.'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Migration error: {str(e)}')

@router.post('/clear-data')
def clear_system_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(['ROOT']))
):
    """
    Purge all fake / demo data (students, invigilators, rooms, exams, allocations).
    Preserves ROOT administrator account and standard institutional departments.
    """
    from clear_fake_data import clear_all_fake_data
    try:
        clear_all_fake_data(db)
        return {
            'success': True,
            'message': 'All mock/demo data successfully purged. Database is ready for real institutional data.'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to clear data: {str(e)}')

