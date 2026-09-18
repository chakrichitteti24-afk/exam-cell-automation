@echo off
echo ========================================================
echo Gokula Krishna College of Engineering (GKCE)
echo Autonomous Examination Cell Automation System Launcher
echo ========================================================
echo.
echo Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "GKCE Backend (FastAPI)" cmd /k "cd backend && python run.py"
timeout /t 3 /nobreak > nul
echo Starting Next.js Frontend on http://localhost:3000 ...
start "GKCE Frontend (Next.js)" cmd /k "cd frontend && npm run dev"
echo.
echo ========================================================
echo Both servers launched successfully!
echo Backend Swagger Docs : http://127.0.0.1:8000/docs
echo Frontend Portal URL  : http://localhost:3000
echo ========================================================
