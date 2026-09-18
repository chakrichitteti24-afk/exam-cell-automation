"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  DoorOpen,
  Calendar,
  UserCheck,
  Grid3X3,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Clock,
  Building2,
  UploadCloud,
  RotateCcw,
  Layers,
  Activity,
  ChevronRight,
  Rocket,
  X,
} from "lucide-react";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import {
  api,
  ApiStudent,
  ApiRoom,
  ApiInvigilator,
  ApiExam,
  ApiAllocationSummary,
  ApiExamLaunchResponse,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function RootDashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [invigilators, setInvigilators] = useState<ApiInvigilator[]>([]);
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [summary, setSummary] = useState<ApiAllocationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<ApiExamLaunchResponse | null>(null);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [allocationMode, setAllocationMode] = useState<"MULTI_EXAM" | "COMMON_EXAM">("MULTI_EXAM");

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    async function loadData() {
      try {
        const [stRes, rmRes, invRes, exRes, sumRes] = await Promise.all([
          api.students.list({ limit: 500 }),
          api.rooms.list(),
          api.invigilators.list(),
          api.exams.list(),
          api.allocation.getSummary().catch(() => null),
        ]);
        setStudents(stRes);
        setRooms(rmRes);
        setInvigilators(invRes);
        setExams(exRes);
        setSummary(sumRes);
      } catch (err) {
        console.warn("Dashboard data load notice:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [authLoading, isAuthenticated]);

  /* ── Derived calculations ── */
  const totalStudents = students.length;
  const totalRooms = rooms.length;
  const totalBenches = rooms.reduce((acc, r) => acc + r.total_benches, 0);
  const totalCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);
  const activeExams = exams.filter((e) => e.status !== "COMPLETED").length;
  const allocatedStudents = summary?.total_students_allocated ?? 0;
  const mixingCompliance = summary?.branch_mixing_compliance_percent ?? 0.0;
  const isAllocated = allocatedStudents > 0;
  const assignedInvigilators = invigilators.filter((i) => i.assigned_room).length;
  const scheduledExams = exams.filter((e) => e.status === "SCHEDULED");

  /* ── Handlers ── */
  const handleRunSeatingEngine = async () => {
    if (exams.length === 0 || rooms.length === 0) return;
    setIsAllocating(true);
    try {
      const roomIds = rooms.map((r) => r.id);
      if (allocationMode === "MULTI_EXAM" && scheduledExams.length > 0) {
        await api.allocation.generate({
          exam_ids: scheduledExams.map((e) => e.id),
          room_ids: roomIds,
          strategy: "MULTI_BRANCH_MIXING",
          arrangement_direction: "COLUMN_WISE",
        });
      } else {
        await api.allocation.generate({
          exam_id: exams[0].id,
          room_ids: roomIds,
          strategy: "MULTI_BRANCH_MIXING",
          arrangement_direction: "COLUMN_WISE",
        });
      }
      const updatedSummary = await api.allocation.getSummary();
      setSummary(updatedSummary);
    } catch (err: unknown) {
      alert(`Seating engine execution error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsAllocating(false);
    }
  };

  const handleLaunchExamSession = async () => {
    if (exams.length === 0 || rooms.length === 0) return;
    setIsLaunching(true);
    try {
      const roomIds = rooms.map((r) => r.id);
      const res = await api.exams.launch({
        strategy: "MULTI_BRANCH_MIXING",
        arrangement_direction: "COLUMN_WISE",
        room_ids: roomIds,
        auto_assign_invigilators: true,
      });
      setLaunchResult(res);
      setShowLaunchModal(true);

      const [updatedSummary, updatedExams, updatedInv] = await Promise.all([
        api.allocation.getSummary(),
        api.exams.list(),
        api.invigilators.list(),
      ]);
      setSummary(updatedSummary);
      setExams(updatedExams);
      setInvigilators(updatedInv);
    } catch (err: unknown) {
      alert(`Exam launch failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleResetAllocations = async () => {
    if (!confirm("Are you sure you want to reset all seating allocations back to unassigned?")) return;
    setIsAllocating(true);
    try {
      await api.allocation.reset();
      setLaunchResult(null);
      const [updatedSummary, updatedExams, updatedInv] = await Promise.all([
        api.allocation.getSummary(),
        api.exams.list(),
        api.invigilators.list(),
      ]);
      setSummary(updatedSummary);
      setExams(updatedExams);
      setInvigilators(updatedInv);
    } catch (err: unknown) {
      alert(`Reset failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsAllocating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Exam Cell Control Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/70">
              Session 2026-27
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Autonomous seating allocation engine, hall capacity radar & candidate desk assignment.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Secondary White Button */}
          <Link
            href="/root/students"
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-semibold bg-white/60 backdrop-blur-xl border-white/60 border border-slate-300 hover:bg-slate-50 text-slate-800 shadow-2xs transition touch-target sm:touch-auto"
          >
            <UploadCloud className="h-3.5 w-3.5 text-slate-500" />
            <span>Import Candidates</span>
          </Link>

          {/* Primary Blue Button */}
          <button
            onClick={handleRunSeatingEngine}
            disabled={isAllocating || isLaunching || exams.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl text-xs font-semibold bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:opacity-50 text-white shadow-sm shadow-blue-700/20 transition touch-target sm:touch-auto"
          >
            <Sparkles className={`h-3.5 w-3.5 ${isAllocating ? "animate-spin" : ""}`} />
            <span>
              {isAllocating
                ? "Allocating Seats..."
                : isAllocated
                ? "Re-run Engine"
                : "Run Seating Engine"}
            </span>
          </button>

          {/* Launch Exam Session Button */}
          <button
            onClick={handleLaunchExamSession}
            disabled={isAllocating || isLaunching || exams.length === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white shadow-sm shadow-emerald-600/20 transition touch-target sm:touch-auto"
          >
            <Rocket className={`h-3.5 w-3.5 ${isLaunching ? "animate-bounce" : ""}`} />
            <span>
              {isLaunching ? "Launching..." : "Launch Exam Session"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Main Bento Grid ── */}
      <BentoGrid cols={4}>
        {/* ░░ Spotlight Bento Card: Seating Engine (2 cols × 2 rows) ░░ */}
        <BentoCard
          colSpan={2}
          rowSpan={2}
          title="Seating Allocation Engine"
          subtitle="Deterministic multi-branch mixing with zero seat collision"
          icon={<Grid3X3 className="h-5 w-5" />}
          badge={
            isAllocated ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                100% Collision-Free
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                State: Unassigned
              </span>
            )
          }
        >
          <div className="space-y-4 py-1">
            {/* Session Mode Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Layers className="h-4 w-4 text-blue-600" />
                <span className="font-bold">Target Session:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setAllocationMode("MULTI_EXAM")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    allocationMode === "MULTI_EXAM"
                      ? "bg-blue-600 text-white shadow-xs shadow-blue-500/20"
                      : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Multi-Exam Session
                </button>
                <button
                  type="button"
                  onClick={() => setAllocationMode("COMMON_EXAM")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    allocationMode === "COMMON_EXAM"
                      ? "bg-blue-600 text-white shadow-xs shadow-blue-500/20"
                      : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Common Exam
                </button>
              </div>
            </div>

            {/* Visual KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs hover:border-slate-300 transition">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Allocated</span>
                <div className="text-3xl font-black font-mono text-slate-900 mt-0.5">
                  {loading ? "..." : allocatedStudents}
                </div>
                <span className={`text-[10px] font-bold ${isAllocated ? "text-emerald-700" : "text-amber-700"}`}>
                  {isAllocated ? `${summary?.total_rooms_utilized ?? 0} Halls Occupied` : "Pending Run"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs hover:border-slate-300 transition">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Branch Mixing</span>
                <div className="text-3xl font-black font-mono text-slate-900 mt-0.5">
                  {loading ? "..." : `${mixingCompliance}%`}
                </div>
                <span className="text-[10px] text-blue-700 font-bold">
                  {isAllocated ? "Cross-Branch Benches" : "Optimal Guarantee"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs hover:border-slate-300 transition">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Security Rule</span>
                <div className="text-2xl font-black font-mono text-slate-900 mt-0.5">
                  Distinct QPs
                </div>
                <span className="text-[10px] text-emerald-700 font-bold">
                  Neighbour Mixing
                </span>
              </div>
            </div>

            {/* Status Highlights */}
            {isAllocated ? (
              <div className="space-y-2 text-xs text-slate-600 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Multi-Department Mixing:</strong> Side-by-side candidates on each bench write different question papers.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Zero Double-Booking:</strong> Every candidate is assigned an exclusive seat coordinate with zero collisions.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  Initial State: Seating Allotment Pending
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Click the <strong>Blue &quot;Run Seating Engine&quot;</strong> button to generate automated seat matrices with deterministic cross-branch pairing.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              {/* Primary Blue Button */}
              <button
                onClick={handleRunSeatingEngine}
                disabled={isAllocating || exams.length === 0}
                className="flex-1 w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:opacity-50 text-white font-bold text-xs shadow-sm shadow-blue-700/20 transition"
              >
                <Sparkles className={`h-4 w-4 ${isAllocating ? "animate-spin" : ""}`} />
                <span>
                  {isAllocating
                    ? "Executing Seating Engine..."
                    : isAllocated
                    ? "Re-run Seating Engine"
                    : "Run Seating Engine (Auto-Allot Seats)"}
                </span>
              </button>

              {isAllocated && (
                <>
                  <Link
                    href="/root/allocation"
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs transition shadow-xs"
                  >
                    <span>View Matrix</span>
                    <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                  </Link>
                  <button
                    onClick={handleResetAllocations}
                    disabled={isAllocating}
                    title="Reset allocations back to unassigned"
                    className="w-full sm:w-auto p-3 rounded-xl border border-slate-300 bg-white/60 backdrop-blur-xl border-white/60 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 text-xs font-semibold shadow-2xs transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </BentoCard>

        {/* ░░ Bento Card: Enrolled Students (1 col × 1 row) ░░ */}
        <BentoCard
          colSpan={1}
          rowSpan={1}
          title="Students"
          subtitle="Enrolled candidates"
          icon={<Users className="h-5 w-5" />}
          badge={
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
              Candidates
            </span>
          }
        >
          <div className="flex flex-col justify-between h-full space-y-4">
            <div>
              <div className="text-4xl font-black font-mono text-slate-900">
                {loading ? "..." : totalStudents}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {totalStudents === 0 ? "No candidates in database" : "Enrolled for examinations"}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <Link
                href="/root/students"
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-xs font-semibold text-slate-800 transition shadow-2xs"
              >
                <span>Manage Candidates</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
        </BentoCard>

        {/* ░░ Bento Card: Exam Halls (1 col × 1 row) ░░ */}
        <BentoCard
          colSpan={1}
          rowSpan={1}
          title="Exam Halls"
          subtitle="Configured capacity"
          icon={<DoorOpen className="h-5 w-5" />}
          badge={
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
              {loading ? "..." : `${totalRooms} Halls`}
            </span>
          }
        >
          <div className="flex flex-col justify-between h-full space-y-4">
            <div>
              <div className="text-4xl font-black font-mono text-slate-900">
                {loading ? "..." : totalCapacity}{" "}
                <span className="text-xs font-normal text-slate-400">Seats</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {loading ? "..." : `${totalBenches} benches @ 2 seats / bench`}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <Link
                href="/root/rooms"
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-xs font-semibold text-slate-800 transition shadow-2xs"
              >
                <span>Hall Configurations</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
        </BentoCard>

        {/* ░░ Bento Card: Faculty Invigilators (1 col × 1 row) ░░ */}
        <BentoCard
          colSpan={1}
          rowSpan={1}
          title="Invigilators"
          subtitle="Faculty supervisors"
          icon={<UserCheck className="h-5 w-5" />}
          badge={
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              Faculty
            </span>
          }
        >
          <div className="flex flex-col justify-between h-full space-y-4">
            <div>
              <div className="text-4xl font-black font-mono text-slate-900">
                {loading ? "..." : invigilators.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {invigilators.length === 0
                  ? "No faculty supervisors assigned"
                  : `${assignedInvigilators} assigned to duties`}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <Link
                href="/root/invigilators"
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-xs font-semibold text-slate-800 transition shadow-2xs"
              >
                <span>Duty Roster</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
        </BentoCard>

        {/* ░░ Bento Card: Scheduled Exams (1 col × 1 row) ░░ */}
        <BentoCard
          colSpan={1}
          rowSpan={1}
          title="Scheduled Exams"
          subtitle="Examination calendar"
          icon={<Calendar className="h-5 w-5" />}
          badge={
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
              {loading ? "..." : `${activeExams} Active`}
            </span>
          }
        >
          <div className="flex flex-col justify-between h-full space-y-4">
            <div>
              <div className="text-4xl font-black font-mono text-slate-900">
                {loading ? "..." : exams.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {exams.length === 0
                  ? "No examination sessions created"
                  : `${activeExams} scheduled sessions`}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <Link
                href="/root/exams"
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-xs font-semibold text-slate-800 transition shadow-2xs"
              >
                <span>View Timetable</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
        </BentoCard>

        {/* ░░ Bento Card: Hall Allocation Roster (2 cols × 1 row) ░░ */}
        <BentoCard
          colSpan={2}
          rowSpan={1}
          title="Hall Allocation Roster"
          subtitle="Live occupied seats and capacity fill rate per examination room"
          icon={<Building2 className="h-5 w-5" />}
          badge={
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
              <Activity className="h-3 w-3 text-blue-600" /> Live Halls
            </span>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 py-1">
            {rooms.length === 0 ? (
              <div className="col-span-full p-4 text-center text-xs text-slate-400">
                No rooms configured. Add rooms in Rooms & Benches.
              </div>
            ) : (
              rooms.map((room) => {
                const currentOccupancy = summary?.room_occupancy?.[room.id] || 0;
                const fillPercent = room.capacity > 0 ? Math.round((currentOccupancy / room.capacity) * 100) : 0;

                return (
                  <div
                    key={room.id}
                    className="p-3 rounded-xl border border-slate-200/90 bg-slate-50 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">
                        Room {room.room_number}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-white/60 backdrop-blur-xl border-white/60 text-slate-600 border border-slate-200">
                        {room.block}
                      </span>
                    </div>

                    <div className="mt-2.5 space-y-1">
                      {/* Clean Blue Progress Bar */}
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800">
                          {currentOccupancy} / {room.capacity}
                        </span>
                        <span className={currentOccupancy > 0 ? "text-blue-600 font-bold" : "text-slate-400 font-medium"}>
                          {fillPercent}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </BentoCard>

        {/* ░░ Bento Card: Anti-Cheating Architecture (2 cols × 1 row) ░░ */}
        <BentoCard
          colSpan={2}
          rowSpan={1}
          title="Anti-Cheating Security Architecture"
          subtitle="Automated cross-department candidate separation & verification"
          icon={<ShieldCheck className="h-5 w-5" />}
          badge={
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Active Enforced
            </span>
          }
        >
          <div className="space-y-2 py-1 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-slate-700 font-medium">
                  Distinct examination question papers per bench neighbour
                </span>
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 font-mono">
                Mixing Rule
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-slate-700 font-medium">
                  Invigilator attendance access sandboxed strictly to assigned room
                </span>
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 font-mono">
                RBAC Lock
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-slate-700 font-medium">
                  Candidate desk slips isolated — students view only their own assigned seat
                </span>
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 font-mono">
                Zero Leakage
              </span>
            </div>
          </div>
        </BentoCard>
      </BentoGrid>

      {/* ── Exam Launch Confirmation / Duty Roster Modal ── */}
      {showLaunchModal && launchResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
                  <Rocket className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Examination Session Launched
                  </h3>
                  <p className="text-xs text-slate-500">
                    Seating grid activated & invigilator duty roster deployed
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLaunchModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-3 gap-3 p-5 bg-white/60 backdrop-blur-xl border-white/60 border-b border-slate-100 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {launchResult.total_students_allocated}
                </div>
                <div className="text-[11px] font-semibold text-slate-500">Candidates Seated</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <div className="text-2xl font-black text-blue-600 font-mono">
                  {launchResult.rooms_utilized}
                </div>
                <div className="text-[11px] font-semibold text-slate-500">Halls Utilized</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/70">
                <div className="text-2xl font-black text-emerald-700 font-mono">
                  {launchResult.branch_mixing_compliance_percent}%
                </div>
                <div className="text-[11px] font-semibold text-emerald-700">Mixing Compliance</div>
              </div>
            </div>

            {/* Duty Roster List */}
            <div className="p-5 max-h-72 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Active Hall Duty Roster
                </span>
                <span className="text-emerald-700 font-medium text-[11px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  ✓ Non-Subject Faculty Assigned
                </span>
              </div>

              {launchResult.duty_roster && launchResult.duty_roster.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                  {launchResult.duty_roster.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white/60 backdrop-blur-xl border-white/60 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 font-mono font-bold flex items-center justify-center text-xs shrink-0 border border-blue-200/60">
                          {item.room_number}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {item.invigilator_name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.faculty_id} • Dept of {item.department_code}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-800">
                          Room {item.room_number} ({item.block})
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {item.total_candidates} candidates assigned
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No invigilators assigned yet.</p>
              )}

              {/* Exclusion policy note */}
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/60 text-[11px] text-blue-900 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Academic Conflict Prevention:</strong> Faculty members who teach the examination subject are strictly excluded from invigilating that room, serving only as fallback alternatives.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/root/invigilators"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
              >
                View Full Invigilator Roster →
              </Link>
              <button
                onClick={() => setShowLaunchModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
