# Gokula Krishna College of Engineering (GKCE) — Exam Cell Automation System

An academic-grade, production-ready Examination Cell Automation System built for **Gokula Krishna College of Engineering (Autonomous)**.

---

## Tech Stack Overview

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Bento Grid layout system, Lucide React icons
- **Backend** *(Phase 2+)*: Python, FastAPI, SQLAlchemy 2.0 ORM, Alembic, PostgreSQL (Neon), JWT Authentication & RBAC

---

## Role-Based Access Control (RBAC) & Authorization

The system enforces strict **Role-Based Access Control (RBAC)** across 3 distinct roles:

1. **ROOT (Admin / Controller of Examinations)**
   - Access restricted to `/root/*`
   - Overview Dashboard with real-time exam hall capacity and candidate metrics
   - Student Directory with pagination, editing, and CSV/Excel batch importing
   - Invigilator management and hall duty assignments
   - Examination Halls & Bench configuration (Standard: 24 benches × 2 seats = 48 students, configurable)
   - Exam timetable scheduling
   - **Automated Seating Allocation Engine**: Multi-branch mixing (CSE + ECE, CSE + EEE), random student shuffling, zero-collision guarantees, meaningful constraint warnings, and interactive 2D room matrix for Room 101 & Room 102
   - Reports & Official Printouts (Door notices, duty rosters, batch desk slips)
   - System settings (branch-mixing thresholds, default room capacities)

2. **INVIGILATOR (Faculty Hall Supervisor)**
   - Access restricted to `/invigilator/*`
   - **Resource-level authorization**: Sandboxed strictly to their assigned examination room (e.g., Room 101). Attempts to access other halls (Room 102 or 201) trigger a **403 Forbidden Access Denied** barrier.
   - Today's duty overview with live countdown timer
   - Interactive seating arrangement grid for the assigned room
   - Live candidate verification and attendance marking (Present / Absent toggle)

3. **STUDENT (Candidate)**
   - Access restricted to `/student/*`
   - Mobile-first, high-contrast digital desk slip
   - Prominently highlights:
     - **Subject**: MATHEMATICS - III (MAT301)
     - **Date & Time**: 15 September 2026 • 10:00 AM - 1:00 PM
     - **ROOM**: 101
     - **BLOCK**: A
     - **BENCH**: 12
     - **SEAT**: 01
   - Security QR code verification for biometric entrance check-in
   - Candidate guidelines and multi-exam timetable schedule

---

## Credentials Registry & Role Redirect

When a user submits their credentials at `/login`, the system authenticates the user, resolves their role, and opens **only** their authorized dashboard:

| Role | Username / Identifier | Password | Opens Dashboard |
|---|---|---|---|
| **Root Administrator** | `admin@gkce.edu.in` | `Admin@123` | [`/root/dashboard`](http://localhost:3000/root/dashboard) |
| **Faculty Invigilator** | `prof.sharma@gkce.edu.in` | `Faculty@123` | [`/invigilator/dashboard`](http://localhost:3000/invigilator/dashboard) |
| **Student** | `23CS042` or `23cs042@student.gkce.edu.in` | `Student@123` | [`/student/dashboard`](http://localhost:3000/student/dashboard) |

> Any student roll number in the GKCE database (e.g. `23CS001` - `23CS024`, `23EC001`, `23EE001`) can also log in with password `Student@123`.

---

## Protected Route Guard (`ProtectedRoute.tsx`)

Every role dashboard layout is wrapped in `<ProtectedRoute allowedRoles={[...]}>`:
- **Unauthenticated visitors** are automatically redirected to `/login`.
- **Cross-role violations** (e.g., a Student attempting to visit `/root/dashboard` or an Invigilator attempting to visit `/root/dashboard`) render a **403 Forbidden Access Denied** screen with a button to return to their authorized dashboard.
- Logging out clears the session token and redirects to `/login`.

---

## Quick Start — Running the Application

### 1. Start the FastAPI Backend (Port 8000)
```bash
# Navigate to backend directory and start server
cd backend
python run.py
```
> The backend initializes and seeds `gkce_exam_cell.db` on startup and serves API endpoints at `http://127.0.0.1:8000/api/v1` (Swagger Docs: `http://127.0.0.1:8000/docs`).

### 2. Start the Next.js Frontend (Port 3000)
```bash
# Navigate to frontend directory and start dev server
cd frontend
npm run dev
```

Visit: [http://localhost:3000](http://localhost:3000) (automatically directs unauthenticated users to `/login`).
All views fetch live data directly from the SQLite database via `/api/v1` with authentic JWT authentication.
