"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  DoorOpen,
  Calendar,
  Clock,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserX,
  FileCheck2,
  ArrowRight,
} from "lucide-react";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { RoomSeatingGrid } from "@/components/seating/RoomSeatingGrid";
import { api, ApiDutyAssignment, mapApiMatrixToRoomMatrix } from "@/lib/api";
import { RoomSeatingMatrix } from "@/types";
import { useAuth } from "@/context/AuthContext";

export default function InvigilatorDashboardPage() {
  const { user } = useAuth();
  const [duty, setDuty] = useState<ApiDutyAssignment | null>(null);
  const [matrix, setMatrix] = useState<RoomSeatingMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceSubmitted, setAttendanceSubmitted] = useState(false);

  useEffect(() => {
    async function loadDutyAndMatrix() {
      setLoading(true);
      try {
        const duties = await api.invigilators.myDuties();
        if (duties.length > 0) {
          const activeDuty = duties[0];
          setDuty(activeDuty);

          const apiMatrix = await api.allocation.getRoomMatrix(activeDuty.room_id, activeDuty.exam_id);
          const mapped = mapApiMatrixToRoomMatrix(apiMatrix, activeDuty.exam_id);
          setMatrix(mapped);
        }
      } catch (err) {
        console.error("Failed to load duty roster or seating matrix:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDutyAndMatrix();
  }, []);

  // Calculate live presence from real matrix
  const presentCount = matrix
    ? matrix.benches.reduce((acc, b) => {
        return (
          acc +
          (b.seat1 && b.seat1.isPresent !== false ? 1 : 0) +
          (b.seat2 && b.seat2.isPresent !== false ? 1 : 0)
        );
      }, 0)
    : 0;

  const totalSeats = matrix ? matrix.capacity : 48;
  const absentCount = totalSeats - presentCount;

  const handleUpdateAttendance = async (allocId: string, isPresent: boolean) => {
    if (!duty || !matrix) return;

    // Optimistically update matrix state
    setMatrix((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        benches: prev.benches.map((b) => {
          let seat1 = b.seat1;
          let seat2 = b.seat2;
          if (seat1 && seat1.id === allocId) {
            seat1 = { ...seat1, isPresent };
          }
          if (seat2 && seat2.id === allocId) {
            seat2 = { ...seat2, isPresent };
          }
          return { ...b, seat1, seat2 };
        }),
      };
    });

    // Extract studentId from allocId (e.g. alloc-1-12)
    const parts = allocId.split("-");
    const studentId = Number(parts[2]);

    if (!isNaN(studentId)) {
      try {
        await api.attendance.mark({
          exam_id: duty.exam_id,
          student_id: studentId,
          room_id: duty.room_id,
          status: isPresent ? "PRESENT" : "ABSENT",
        });
      } catch (err) {
        console.error("Failed to sync attendance with backend:", err);
      }
    }
  };

  const handleSubmitAttendance = () => {
    setAttendanceSubmitted(true);
    setTimeout(() => setAttendanceSubmitted(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Invigilator Duty Desk
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Active Duty Session
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time examination room supervision, seating layout verification, and live candidate attendance recording.
          </p>
        </div>

        <button
          onClick={handleSubmitAttendance}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-200 transition self-start md:self-auto"
        >
          <FileCheck2 className="h-4 w-4" />
          {attendanceSubmitted ? "Attendance Saved!" : "Submit Attendance Sheet"}
        </button>
      </div>

      {/* Bento Grid Overview */}
      <BentoGrid cols={4}>
        {/* Main Duty Spotlight Bento Card */}
        <BentoCard
          colSpan={2}
          rowSpan={1}
          title="Assigned Examination Duty"
          subtitle={`Authorized Room ${duty?.room_number || "---"} · ${duty?.block || "---"}`}
          icon={<DoorOpen className="h-4 w-4" />}
          badge={
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-200">
              <ShieldCheck className="h-3 w-3" /> Authorized
            </span>
          }
        >
          <div className="space-y-3 mt-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {duty ? `${duty.subject_name} (${duty.subject_code})` : "No Active Duty Scheduled"}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Autonomous Semester Examination · GKCE
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-blue-600 font-mono">
                  Room {duty?.room_number || "---"}
                </span>
                <span className="text-xs text-gray-400 block">{duty?.block || "---"}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5 font-medium">
                <Calendar className="h-3.5 w-3.5 text-gray-300" />
                <span>{duty?.exam_date || "N/A"}</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5 text-gray-300" />
                <span>{duty?.time_slot || "N/A"}</span>
              </div>
            </div>
          </div>
        </BentoCard>

        {/* Headcount Attendance Bento Card */}
        <BentoCard
          colSpan={1}
          rowSpan={1}
          title="Attendance"
          subtitle="Live headcount"
          icon={<UserCheck className="h-4 w-4" />}
          badge={
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {totalSeats > 0 ? ((presentCount / totalSeats) * 100).toFixed(0) : 100}%
            </span>
          }
        >
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold text-gray-900">{presentCount}</span>
              <span className="text-xs text-gray-400">/ {totalSeats}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-500 font-medium">{presentCount} Present</span>
              <span className="text-red-500 font-semibold">{absentCount} Absent</span>
            </div>
            <div className="mt-2 w-full h-1.5 rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: totalSeats > 0 ? `${(presentCount / totalSeats) * 100}%` : "100%" }}
              />
            </div>
          </div>
        </BentoCard>

        {/* Room Capacity Bento Card */}
        <BentoCard
          colSpan={1}
          rowSpan={1}
          title="Bench Stats"
          subtitle="Physical layout"
          icon={<Users className="h-4 w-4" />}
          badge={
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {matrix ? matrix.benches.length : 24} Benches
            </span>
          }
        >
          <div className="mt-2">
            <p className="text-4xl font-bold text-gray-900">
              {totalSeats}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              2 seats / bench · cross-branch mixed
            </p>
          </div>
        </BentoCard>
      </BentoGrid>

      {/* Seating Arrangement Matrix */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Room {duty?.room_number || "---"} Live Seating Grid & Attendance Register
            </h2>
            <p className="text-xs text-slate-500">
              Click any candidate box to view hall ticket credentials and toggle attendance in real time.
            </p>
          </div>
          <span className="text-xs text-slate-700 font-medium font-mono">
            Supervisor: {user?.name || "Faculty Supervisor"}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Loading assigned examination hall seating matrix...
          </div>
        ) : matrix ? (
          <RoomSeatingGrid
            matrix={matrix}
            onUpdateAttendance={handleUpdateAttendance}
            interactive={true}
          />
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">
            No active seating allocation found for this duty hall.
          </div>
        )}
      </div>
    </div>
  );
}
