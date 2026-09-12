"""
Uvicorn Server Launcher for GKCE Exam Cell Automation System
"""
import uvicorn
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    import multiprocessing
    # Use CPU cores for workers, minimum 4 for high concurrency
    workers = max(4, multiprocessing.cpu_count())
    print(f"Starting GKCE Exam Cell Backend on http://0.0.0.0:8000 with {workers} workers...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, workers=workers)
