"""
Uvicorn Server Launcher for GKCE Exam Cell Automation System
"""
import uvicorn
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    import multiprocessing
    from app.core.config import settings

    # Use 1 worker for local development on Windows to prevent WinError 10022 crashes.
    workers = 1

    print(f"Starting GKCE Exam Cell Backend on http://0.0.0.0:8000 with {workers} worker(s)...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, workers=workers, reload=(workers == 1))
