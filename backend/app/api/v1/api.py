from fastapi import APIRouter
from app.api.v1.endpoints import auth, students, invigilators, rooms, exams, allocation, attendance, departments, notifications, system

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(departments.router, prefix="/departments", tags=["Departments"])
api_router.include_router(students.router, prefix="/students", tags=["Students"])
api_router.include_router(invigilators.router, prefix="/invigilators", tags=["Invigilators"])
api_router.include_router(rooms.router, prefix="/rooms", tags=["Rooms & Infrastructure"])
api_router.include_router(exams.router, prefix="/exams", tags=["Examinations"])
api_router.include_router(allocation.router, prefix="/allocation", tags=["Seating Allocation"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["Attendance Tracking"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Push Notifications"])
api_router.include_router(system.router, prefix="/system", tags=["System & Database"])

