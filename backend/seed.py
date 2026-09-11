"""
CLI Seed Runner for GKCE Exam Cell Automation System
"""
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.db.init_db import init_db

def main():
    print("Connecting to database and running seed script...")
    db = SessionLocal()
    try:
        init_db(db, force=True)
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Error initializing database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    main()
