"use client";

import React, { useState, useMemo } from "react";
import { RoomSeatingMatrix, BenchAllocation, StudentAllocation } from "@/types";
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
  Check,
  UserCheck,
  UserX,
  Columns,
  Rows,
  Grid3X3,
  Printer,
  ShieldCheck,
  MapPin,
  Filter,
  DoorOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RoomSeatingGridProps {
  matrix: RoomSeatingMatrix;
  onUpdateAttendance?: (allocationId: string, isPresent: boolean) => void;
  interactive?: boolean;
  highlightRollNumber?: string;
}

export const BRANCH_THEMES: Record<
  string,
  {
    name: string;
    badge: string;
    border: string;
    bg: string;
    text: string;
    accent: string;
    dot: string;
  }
> = {
  CSE: {
    name: "Computer Science",
    badge: "bg-blue-600 text-white font-bold",
    border: "border-blue-300",
    bg: "bg-gradient-to-br from-blue-50/90 via-blue-50/50 to-blue-100/30",
    text: "text-blue-950",
    accent: "text-blue-700",
    dot: "bg-blue-500",
  },
  ECE: {
    name: "Electronics & Comm.",
    badge: "bg-amber-600 text-white font-bold",
    border: "border-amber-300",
    bg: "bg-gradient-to-br from-amber-50/90 via-amber-50/50 to-amber-100/30",
    text: "text-amber-950",
    accent: "text-amber-700",
    dot: "bg-amber-500",
  },
  EEE: {
    name: "Electrical & Electronics",
    badge: "bg-emerald-600 text-white font-bold",
    border: "border-emerald-300",
    bg: "bg-gradient-to-br from-emerald-50/90 via-emerald-50/50 to-emerald-100/30",
    text: "text-emerald-950",
    accent: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  MECH: {
    name: "Mechanical Engg.",
    badge: "bg-purple-600 text-white font-bold",
    border: "border-purple-300",
    bg: "bg-gradient-to-br from-purple-50/90 via-purple-50/50 to-purple-100/30",
    text: "text-purple-950",
    accent: "text-purple-700",
    dot: "bg-purple-500",
  },
  CIVIL: {
    name: "Civil Engineering",
    badge: "bg-rose-600 text-white font-bold",
    border: "border-rose-300",
    bg: "bg-gradient-to-br from-rose-50/90 via-rose-50/50 to-rose-100/30",
    text: "text-rose-950",
    accent: "text-rose-700",
    dot: "bg-rose-500",
  },
};

const DEFAULT_BRANCH_THEME = {
  name: "General",
  badge: "bg-slate-600 text-white font-bold",
  border: "border-slate-300",
  bg: "bg-slate-50",
  text: "text-slate-900",
  accent: "text-slate-700",
  dot: "bg-slate-500",
};

export function RoomSeatingGrid({
  matrix,
  onUpdateAttendance,
  interactive = true,
  highlightRollNumber = "",
}: RoomSeatingGridProps) {
  const [searchTerm, setSearchTerm] = useState(highlightRollNumber);
  const [selectedStudent, setSelectedStudent] = useState<StudentAllocation | null>(null);
  const [selectedBenchPartner, setSelectedBenchPartner] = useState<StudentAllocation | null>(null);
  const [viewMode, setViewMode] = useState<"GRID" | "COLUMN_WISE" | "ROW_WISE">("GRID");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("ALL");
  const [attendanceFilter, setAttendanceFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");

  const isSemExam = matrix.examType === "SEM";
  const subdivisionLabel = useMemo(() => {
    switch (matrix.examSubdivision) {
      case "MID_1":
        return "Mid-1 Exam • Dual Seater (48 Seats)";
      case "MID_2":
        return "Mid-2 Exam • Dual Seater (48 Seats)";
      case "REGULAR":
        return "Semester Regular Exam • Single Seater (24 Seats)";
      case "SUPPLEMENTARY":
        return "Semester Supplementary Exam • Single Seater (24 Seats)";
      default:
        return isSemExam ? "Semester Exam • Single Seater" : "Mid Exam • Dual Seater";
    }
  }, [matrix.examSubdivision, isSemExam]);

  const totalBenches = matrix.benches.length;
  const sameBranchCount = matrix.benches.filter(
    (b) => b.seat1 && b.seat2 && b.seat1.departmentCode === b.seat2.departmentCode
  ).length;

  const totalOccupied = matrix.benches.reduce(
    (acc, b) => acc + (b.seat1 ? 1 : 0) + (b.seat2 ? 1 : 0),
    0
  );

  const presentCount = matrix.benches.reduce(
    (acc, b) =>
      acc +
      (b.seat1 && b.seat1.isPresent !== false ? 1 : 0) +
      (b.seat2 && b.seat2.isPresent !== false ? 1 : 0),
    0
  );
  const absentCount = totalOccupied - presentCount;

  // Department counts for dynamic legend
  const departmentCounts: Record<string, number> = {};
  matrix.benches.forEach((bench) => {
    if (bench.seat1) {
      const d1 = bench.seat1.departmentCode;
      departmentCounts[d1] = (departmentCounts[d1] || 0) + 1;
    }
    if (bench.seat2) {
      const d2 = bench.seat2.departmentCode;
      departmentCounts[d2] = (departmentCounts[d2] || 0) + 1;
    }
  });

  // Handle student click to open inspector with bench partner info
  const handleStudentClick = (
    student: StudentAllocation,
    partner?: StudentAllocation
  ) => {
    if (!interactive) return;
    setSelectedStudent(student);
    setSelectedBenchPartner(partner || null);
  };

  /**
   * Render a Single Bench Card (DESK 01 .. DESK 24)
   */
  const renderBench = (bench: BenchAllocation) => {
    const isMixed = bench.isMixedBranch;

    // Search term matching
    const isSeat1Match =
      searchTerm &&
      bench.seat1 &&
      (bench.seat1.studentRoll.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bench.seat1.studentName.toLowerCase().includes(searchTerm.toLowerCase()));

    const isSeat2Match =
      searchTerm &&
      bench.seat2 &&
      (bench.seat2.studentRoll.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bench.seat2.studentName.toLowerCase().includes(searchTerm.toLowerCase()));

    const isBenchHighlighted = Boolean(isSeat1Match || isSeat2Match);

    // Department filter matching
    const seat1DeptMatches =
      selectedDeptFilter === "ALL" || bench.seat1?.departmentCode === selectedDeptFilter;
    const seat2DeptMatches =
      selectedDeptFilter === "ALL" || bench.seat2?.departmentCode === selectedDeptFilter;

    // Attendance filter matching
    const seat1AttMatches =
      attendanceFilter === "ALL" ||
      (attendanceFilter === "PRESENT" && bench.seat1?.isPresent !== false) ||
      (attendanceFilter === "ABSENT" && bench.seat1?.isPresent === false);

    const seat2AttMatches =
      attendanceFilter === "ALL" ||
      (attendanceFilter === "PRESENT" && bench.seat2?.isPresent !== false) ||
      (attendanceFilter === "ABSENT" && bench.seat2?.isPresent === false);

    return (
      <div
        key={bench.benchNumber}
        className={cn(
          "relative rounded-2xl border bg-white/60 backdrop-blur-xl border-white/60 transition-all shadow-xs flex flex-col justify-between h-full min-h-[160px] overflow-hidden",
          isBenchHighlighted
            ? "ring-2 ring-blue-600 shadow-md scale-[1.02] border-blue-500 z-10"
            : "border-slate-200/90 hover:border-slate-300 hover:shadow-sm"
        )}
      >
        {/* Physical Wooden/Slate Desk Edge Header */}
        <div className="bg-slate-50/90 px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-800 font-mono tracking-tight text-[11px]">
              DESK {String(bench.benchNumber).padStart(2, "0")}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/60 backdrop-blur-xl border-white/60 border border-slate-200 text-slate-500 font-semibold">
              R{bench.rowIndex ?? Math.floor((bench.benchNumber - 1) / 4) + 1}·C
              {bench.colIndex ?? (((bench.benchNumber - 1) % 4) + 1)}
            </span>
          </div>

          {/* Mixing badge or Single Seater Badge */}
          {bench.isSemSingleSeater || isSemExam ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80">
              <ShieldCheck className="h-3 w-3 text-purple-600" />
              <span>{matrix.examSubdivision === "SUPPLEMENTARY" ? "Single (Supply)" : "Single (SEM)"}</span>
            </span>
          ) : isMixed ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span>{matrix.examSubdivision === "MID_2" ? "Mixed (Mid-2)" : "Mixed (Mid-1)"}</span>
            </span>
          ) : bench.seat1 && bench.seat2 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              <span>Same</span>
            </span>
          ) : (
            <span className="text-[10px] font-medium text-slate-400">Single</span>
          )}
        </div>

        {/* Dual Seats with Central Physical Divider */}
        <div className="p-2 grid grid-cols-2 gap-2 relative flex-1">
          {/* Subtle center vertical divider */}
          <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-px bg-slate-200/60 pointer-events-none" />

          {/* Seat 1 (Left) */}
          <SeatCard
            seatNumber={1}
            allocation={bench.seat1}
            isHighlighted={Boolean(isSeat1Match)}
            isDimmed={Boolean(!seat1DeptMatches || !seat1AttMatches)}
            onClick={() => bench.seat1 && handleStudentClick(bench.seat1, bench.seat2)}
          />

          {/* Seat 2 (Right): Vacant buffer in SEM exams, or candidate seat in MID exams */}
          {bench.isSemSingleSeater || isSemExam ? (
            <div className="h-24 rounded-xl border border-dashed border-purple-200 bg-purple-50/40 flex flex-col items-center justify-center p-2 text-center select-none">
              <ShieldCheck className="h-4 w-4 text-purple-500 mb-1" />
              <span className="text-[9px] text-purple-700 font-mono font-bold uppercase tracking-tight">
                Seat 02 Vacant
              </span>
              <span className="text-[8px] text-purple-500 font-medium">
                {matrix.examSubdivision === "SUPPLEMENTARY" ? "Supply Buffer" : "Sem Buffer"}
              </span>
            </div>
          ) : (
            <SeatCard
              seatNumber={2}
              allocation={bench.seat2}
              isHighlighted={Boolean(isSeat2Match)}
              isDimmed={Boolean(!seat2DeptMatches || !seat2AttMatches)}
              onClick={() => bench.seat2 && handleStudentClick(bench.seat2, bench.seat1)}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Top Controls & Statistics Banner ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/60 backdrop-blur-xl border-white/60 border border-slate-200 text-slate-900 p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-blue-600 text-white text-xs font-black tracking-wide uppercase shadow-xs">
              Room {matrix.roomNumber}
            </span>
            <span className="text-slate-500 text-xs font-semibold">Block {matrix.block}</span>
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                isSemExam
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              )}
            >
              {subdivisionLabel}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              100% Collision-Free
            </span>
          </div>
          <h2 className="text-lg font-black mt-1.5 text-slate-900 tracking-tight">
            Hall Seating Matrix & Bench Floorplan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSemExam
              ? `Physical layout radar • Single Candidate Per Bench • ${matrix.allocatedCount} Candidates (${totalBenches} Benches × 1 Seat)`
              : `Physical layout radar • Dual Candidates Per Bench • ${matrix.capacity} Seats (${totalBenches} Benches × 2 Seats)`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <button
              onClick={() => setViewMode("GRID")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs",
                viewMode === "GRID"
                  ? "bg-white/60 backdrop-blur-xl border-white/60 text-blue-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
              title="Classroom 2D Floorplan (4 Columns × 6 Rows)"
            >
              <Grid3X3 className="h-3.5 w-3.5" />
              <span>Hall Grid</span>
            </button>
            <button
              onClick={() => setViewMode("COLUMN_WISE")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs",
                viewMode === "COLUMN_WISE"
                  ? "bg-white/60 backdrop-blur-xl border-white/60 text-blue-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
              title="View Column by Column"
            >
              <Columns className="h-3.5 w-3.5" />
              <span>Columns</span>
            </button>
            <button
              onClick={() => setViewMode("ROW_WISE")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs",
                viewMode === "ROW_WISE"
                  ? "bg-white/60 backdrop-blur-xl border-white/60 text-blue-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
              title="View Row by Row"
            >
              <Rows className="h-3.5 w-3.5" />
              <span>Rows</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-7 py-1.5 text-xs bg-white/60 backdrop-blur-xl border-white/60 text-slate-900 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 shadow-2xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
            title="Print Door Seating Chart"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Print Chart</span>
          </button>
        </div>
      </div>

      {/* ── Interactive Department Legend & Filters Ribbon ── */}
      <div className="p-3.5 rounded-2xl bg-white/60 backdrop-blur-xl border-white/60 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Filter className="h-3.5 w-3.5" /> Filter Branch:
          </span>

          <button
            onClick={() => setSelectedDeptFilter("ALL")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold transition border",
              selectedDeptFilter === "ALL"
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            )}
          >
            All Candidates ({totalOccupied})
          </button>

          {Object.entries(departmentCounts).map(([dept, count]) => {
            const theme = BRANCH_THEMES[dept] || DEFAULT_BRANCH_THEME;
            const isSelected = selectedDeptFilter === dept;

            return (
              <button
                key={dept}
                onClick={() => setSelectedDeptFilter(isSelected ? "ALL" : dept)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition border",
                  isSelected
                    ? `${theme.badge} shadow-xs`
                    : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
                <span>{dept}</span>
                <span className="text-[10px] font-mono opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Live Attendance Indicators */}
        <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
          <button
            onClick={() =>
              setAttendanceFilter((curr) => (curr === "PRESENT" ? "ALL" : "PRESENT"))
            }
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition",
              attendanceFilter === "PRESENT"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/60"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Present: {presentCount}</span>
          </button>

          <button
            onClick={() =>
              setAttendanceFilter((curr) => (curr === "ABSENT" ? "ALL" : "ABSENT"))
            }
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition",
              attendanceFilter === "ABSENT"
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100/60"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span>Absent: {absentCount}</span>
          </button>
        </div>
      </div>
      {/* Same branch warning alert if applicable */}
      {sameBranchCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Notice: {sameBranchCount} bench(es) have students from the same branch due to candidate branch distribution constraints.
          </span>
        </div>
      )}

      {/* ── Floorplan Architectural Container ── */}
      <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 p-4 sm:p-6 shadow-xs space-y-4">
        {/* 1. Chalkboard & Teacher Podium Area */}
        <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-3.5 text-center shadow-sm border border-slate-700 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-500" />
          <div className="flex items-center justify-center gap-2 font-mono text-xs font-bold tracking-widest uppercase text-slate-200">
            <span>▲ FRONT OF EXAMINATION HALL • TEACHER PODIUM & BLACKBOARD ▲</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Invigilator Desk & Supervision Post • Room {matrix.roomNumber} (Block {matrix.block})
          </p>
        </div>

        {/* 2. Entrance Door & Aisle Radar */}
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-bold text-blue-900 bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 font-mono text-xs shadow-2xs">
              <DoorOpen className="h-3.5 w-3.5" /> MAIN ENTRANCE DOOR
            </span>
            <span className="text-slate-500 text-[11px] hidden sm:inline">
              ← Candidate entry & barcode scanning point
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono font-bold text-slate-600">
            <span className="hidden md:inline text-slate-400">Walking Aisles:</span>
            <span>Aisle 1 (Left)</span>
            <span className="text-slate-300">•</span>
            <span>Center Aisle</span>
            <span className="text-slate-300">•</span>
            <span>Window Aisle (Right)</span>
          </div>
        </div>

      {/* View Mode 1: HALL GRID (Pixel-Perfect Alignment) */}
      {viewMode === "GRID" && (
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[720px] space-y-3">
            {/* Column Indicators exactly aligned with the 4 Bench Columns */}
            <div className="flex items-center gap-3">
            <div className="w-10 sm:w-12 shrink-0 text-center font-mono text-[10px] font-bold text-slate-400">
              ROW
            </div>
            <div className="flex-1 grid grid-cols-4 gap-3 sm:gap-4 text-center font-mono text-[11px] font-bold text-slate-600">
              <div className="py-1.5 rounded-lg bg-slate-100 border border-slate-200/80">
                COLUMN 1 <span className="font-normal text-[10px] text-slate-400 hidden sm:inline">(Left Aisle)</span>
              </div>
              <div className="py-1.5 rounded-lg bg-slate-100 border border-slate-200/80">
                COLUMN 2 <span className="font-normal text-[10px] text-slate-400 hidden sm:inline">(Center Left)</span>
              </div>
              <div className="py-1.5 rounded-lg bg-slate-100 border border-slate-200/80">
                COLUMN 3 <span className="font-normal text-[10px] text-slate-400 hidden sm:inline">(Center Right)</span>
              </div>
              <div className="py-1.5 rounded-lg bg-slate-100 border border-slate-200/80">
                COLUMN 4 <span className="font-normal text-[10px] text-slate-400 hidden sm:inline">(Right Window)</span>
              </div>
            </div>
          </div>

          {/* 6 Rows of Benches with Row Labels */}
          {[1, 2, 3, 4, 5, 6].map((rowNum) => {
            const rowBenches = [1, 2, 3, 4].map((colNum) => {
              return matrix.benches.find(
                (b) =>
                  (b.rowIndex ?? Math.floor((b.benchNumber - 1) / 4) + 1) === rowNum &&
                  (b.colIndex ?? (((b.benchNumber - 1) % 4) + 1)) === colNum
              );
            });

            return (
              <div key={rowNum} className="flex items-stretch gap-3">
                {/* Row Badge on Left */}
                <div className="w-10 sm:w-12 shrink-0 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-1 text-center shadow-xs">
                  <span className="text-xs font-black font-mono text-slate-700">
                    R{rowNum}
                  </span>
                  <span className="text-[8px] font-mono text-slate-400 uppercase font-semibold">Row</span>
                </div>

                {/* 4 Benches */}
                <div className="flex-1 grid grid-cols-4 gap-3 sm:gap-4">
                  {rowBenches.map((bench, idx) =>
                    bench ? (
                      renderBench(bench)
                    ) : (
                      <div
                        key={idx}
                        className="rounded-xl border border-dashed border-slate-200 p-3 flex items-center justify-center text-xs text-slate-400"
                      >
                        Empty Bench
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {/* Rear of Hall */}
          <div className="pt-2 border-t border-dashed border-slate-200 text-center">
            <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400 font-bold">
              ▼ REAR OF EXAMINATION HALL • BACK AISLE ▼
            </span>
          </div>
        </div>
      </div>
      )}

      {/* View Mode 2: COLUMNS FULLY (Vertical Column Lanes) */}
      {viewMode === "COLUMN_WISE" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((colNum) => {
            const colBenches = matrix.benches
              .filter((b) => (b.colIndex ?? (((b.benchNumber - 1) % 4) + 1)) === colNum)
              .sort((a, b) => {
                const rowA = a.rowIndex ?? Math.floor((a.benchNumber - 1) / 4) + 1;
                const rowB = b.rowIndex ?? Math.floor((b.benchNumber - 1) / 4) + 1;
                return rowA - rowB;
              });

            return (
              <div
                key={colNum}
                className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 flex flex-col shadow-2xs"
              >
                <div className="p-2.5 rounded-xl bg-blue-600 text-white text-center shadow-xs">
                  <div className="text-xs font-black tracking-wide uppercase">
                    Column {colNum}
                  </div>
                  <div className="text-[10px] text-blue-100 font-medium mt-0.5">
                    {colNum === 1 ? "Left Aisle" : colNum === 2 ? "Center Left" : colNum === 3 ? "Center Right" : "Right Window"} • {colBenches.length} Benches
                  </div>
                </div>

                <div className="space-y-3 flex-1">
                  {colBenches.map((bench) => renderBench(bench))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Mode 3: ROWS FULLY (Horizontal Row Strips) */}
      {viewMode === "ROW_WISE" && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((rowNum) => {
            const rowBenches = matrix.benches
              .filter((b) => (b.rowIndex ?? Math.floor((b.benchNumber - 1) / 4) + 1) === rowNum)
              .sort((a, b) => {
                const colA = a.colIndex ?? (((a.benchNumber - 1) % 4) + 1);
                const colB = b.colIndex ?? (((b.benchNumber - 1) % 4) + 1);
                return colA - colB;
              });

            if (rowBenches.length === 0) return null;

            return (
              <div
                key={rowNum}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-mono text-xs font-bold shadow-xs">
                      ROW {rowNum}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {rowNum === 1 ? "Front Row (Near Teacher Podium)" : rowNum === 6 ? "Rear Row (Back Aisle)" : `Row ${rowNum} Benches`}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 font-medium">
                    {rowBenches.length} Benches • {rowBenches.length * 2} Seats
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {rowBenches.map((bench) => renderBench(bench))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* ── Candidate Inspector Modal with Bench Partner Verification ── */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white/60 backdrop-blur-xl border-white/60 border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <MapPin className="h-3 w-3" /> Desk {selectedStudent.benchNumber} • Seat{" "}
                  {selectedStudent.seatNumber === 1 ? "01 (Left)" : "02 (Right)"}
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2 tracking-tight">
                  {selectedStudent.studentName}
                </h3>
                <p className="text-xs font-mono font-bold text-blue-700 mt-0.5">
                  {selectedStudent.studentRoll}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setSelectedBenchPartner(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Candidate Credentials Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                <span className="font-black text-slate-900 mt-0.5 block">
                  {selectedStudent.departmentCode}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Exam Subject</span>
                <span className="font-black text-blue-700 font-mono mt-0.5 block">
                  {selectedStudent.subjectCode || "MAT301"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Room / Hall</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  Room {selectedStudent.roomNumber} ({selectedStudent.block})
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Attendance</span>
                <span
                  className={cn(
                    "font-bold mt-0.5 inline-block text-xs",
                    selectedStudent.isPresent !== false ? "text-emerald-700" : "text-rose-600"
                  )}
                >
                  {selectedStudent.isPresent !== false ? "● Present" : "● Absent"}
                </span>
              </div>
            </div>

            {/* Bench Partner Anti-Cheating Verification Card */}
            {selectedBenchPartner ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5 text-[11px]">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Bench Neighbour Separation
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                    Zero Collision
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/60 backdrop-blur-xl border-white/60 border border-emerald-200/60 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{selectedBenchPartner.studentName}</div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {selectedBenchPartner.studentRoll} • Dept of {selectedBenchPartner.departmentCode}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-1 rounded text-slate-800">
                    Seat {selectedBenchPartner.seatNumber === 1 ? "01" : "02"}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-800 leading-tight">
                  ✓ Verified: Sitting neighbour belongs to a distinct branch / writes a distinct paper.
                </p>
              </div>
            ) : isSemExam ? (
              <div className="p-3.5 rounded-2xl bg-purple-50/80 border border-purple-200/90 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-purple-950 text-[11px]">
                  <ShieldCheck className="h-4 w-4 text-purple-600" /> Semester Examination Policy: Single-Seater
                </div>
                <p className="text-[10px] text-purple-800 leading-tight">
                  Under GKCE End-Semester Examination Regulations, this bench accommodates strictly 1 candidate (Seat 01). Seat 02 remains vacant to maintain examination isolation.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 italic text-center">
                Bench partner seat is unallocated.
              </div>
            )}

            {/* Attendance Toggle Controls */}
            {onUpdateAttendance && (
              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => {
                    onUpdateAttendance(selectedStudent.id, true);
                    setSelectedStudent({ ...selectedStudent, isPresent: true });
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-sm transition"
                >
                  <UserCheck className="h-4 w-4" />
                  Mark Present
                </button>
                <button
                  onClick={() => {
                    onUpdateAttendance(selectedStudent.id, false);
                    setSelectedStudent({ ...selectedStudent, isPresent: false });
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold shadow-sm transition"
                >
                  <UserX className="h-4 w-4" />
                  Mark Absent
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Seat Card (Seat 01 Left / Seat 02 Right)
 */
function SeatCard({
  seatNumber,
  allocation,
  isHighlighted,
  isDimmed,
  onClick,
}: {
  seatNumber: 1 | 2;
  allocation?: StudentAllocation;
  isHighlighted: boolean;
  isDimmed: boolean;
  onClick: () => void;
}) {
  if (!allocation) {
    return (
      <div className="h-24 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex flex-col items-center justify-center p-2 text-center">
        <span className="text-[9px] text-slate-400 font-mono font-semibold uppercase">
          Seat 0{seatNumber} ({seatNumber === 1 ? "L" : "R"})
        </span>
        <span className="text-[10px] text-slate-400 italic mt-0.5">Empty Seat</span>
      </div>
    );
  }

  const theme = BRANCH_THEMES[allocation.departmentCode] || DEFAULT_BRANCH_THEME;
  const isAbsent = allocation.isPresent === false;

  return (
    <div
      onClick={onClick}
      className={cn(
        "h-24 rounded-xl border p-2 flex flex-col justify-between cursor-pointer transition-all duration-150 shadow-2xs relative overflow-hidden group",
        theme.bg,
        theme.border,
        "hover:scale-[1.03] hover:shadow-md",
        isHighlighted && "ring-2 ring-blue-600 shadow-md font-bold scale-[1.02]",
        isDimmed && "opacity-30 grayscale-[70%]",
        isAbsent && "opacity-60 grayscale-[40%]"
      )}
    >
      {/* Top row: Seat Label & Department Badge */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-tighter">
          S0{seatNumber} <span className="text-[8px] font-normal">({seatNumber === 1 ? "L" : "R"})</span>
        </span>
        <div className="flex items-center gap-1">
          {allocation.subjectCode && (
            <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-slate-900 text-white shadow-2xs">
              {allocation.subjectCode}
            </span>
          )}
          <span className={cn("text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow-2xs", theme.badge)}>
            {allocation.departmentCode}
          </span>
        </div>
      </div>

      {/* Middle row: Roll number & Name */}
      <div className="my-auto">
        <div className="font-mono text-xs font-black tracking-tight text-slate-900 truncate">
          {allocation.studentRoll}
        </div>
        <div className="text-[10px] font-medium text-slate-700 truncate leading-tight mt-0.5">
          {allocation.studentName}
        </div>
      </div>

      {/* Bottom row: Live Attendance indicator */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-200/40 text-[9px]">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isAbsent ? "bg-rose-500" : "bg-emerald-500"
            )}
          />
          <span className={cn("font-bold text-[9px]", isAbsent ? "text-rose-700" : "text-emerald-800")}>
            {isAbsent ? "Absent" : "Present"}
          </span>
        </div>

        <span className="text-[9px] text-slate-400 group-hover:text-blue-600 font-semibold transition">
          Inspect →
        </span>
      </div>
    </div>
  );
}
