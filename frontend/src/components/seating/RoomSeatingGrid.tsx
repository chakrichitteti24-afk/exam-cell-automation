"use client";

import React, { useState, useMemo, useRef } from "react";
import { RoomSeatingMatrix, BenchAllocation, StudentAllocation } from "@/types";
import {
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
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
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Video,
  Clock,
  Sparkles,
  Compass,
  ArrowDown,
  ArrowRight,
  Eye,
  Maximize2,
  Minimize2,
  Layers,
  FileSpreadsheet
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
    chairBg: string;
    chairBorder: string;
    text: string;
    accent: string;
    dot: string;
  }
> = {
  CSE: {
    name: "Computer Science",
    badge: "bg-blue-50 text-blue-700 border border-blue-200 font-bold",
    border: "border-blue-200 hover:border-blue-400",
    bg: "bg-blue-50/40",
    chairBg: "bg-blue-600",
    chairBorder: "border-blue-700",
    text: "text-slate-900 font-bold",
    accent: "text-blue-700",
    dot: "bg-blue-600",
  },
  ECE: {
    name: "Electronics & Comm.",
    badge: "bg-amber-50 text-amber-800 border border-amber-200 font-bold",
    border: "border-amber-200 hover:border-amber-400",
    bg: "bg-amber-50/40",
    chairBg: "bg-amber-600",
    chairBorder: "border-amber-700",
    text: "text-slate-900 font-bold",
    accent: "text-amber-700",
    dot: "bg-amber-600",
  },
  EEE: {
    name: "Electrical & Electronics",
    badge: "bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold",
    border: "border-emerald-200 hover:border-emerald-400",
    bg: "bg-emerald-50/40",
    chairBg: "bg-emerald-600",
    chairBorder: "border-emerald-700",
    text: "text-slate-900 font-bold",
    accent: "text-emerald-700",
    dot: "bg-emerald-600",
  },
  MECH: {
    name: "Mechanical Engg.",
    badge: "bg-purple-50 text-purple-800 border border-purple-200 font-bold",
    border: "border-purple-200 hover:border-purple-400",
    bg: "bg-purple-50/40",
    chairBg: "bg-purple-600",
    chairBorder: "border-purple-700",
    text: "text-slate-900 font-bold",
    accent: "text-purple-700",
    dot: "bg-purple-600",
  },
  CIVIL: {
    name: "Civil Engineering",
    badge: "bg-rose-50 text-rose-800 border border-rose-200 font-bold",
    border: "border-rose-200 hover:border-rose-400",
    bg: "bg-rose-50/40",
    chairBg: "bg-rose-600",
    chairBorder: "border-rose-700",
    text: "text-slate-900 font-bold",
    accent: "text-rose-700",
    dot: "bg-rose-600",
  },
};

const DEFAULT_BRANCH_THEME = {
  name: "General",
  badge: "bg-slate-100 text-slate-800 border border-slate-200 font-bold",
  border: "border-slate-200 hover:border-slate-400",
  bg: "bg-slate-50",
  chairBg: "bg-slate-600",
  chairBorder: "border-slate-700",
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
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showSequenceFlow, setShowSequenceFlow] = useState<boolean>(false);
  const [showAntiCheatingRadar, setShowAntiCheatingRadar] = useState<boolean>(false);
  const [blueprintMode, setBlueprintMode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [columnDensity, setColumnDensity] = useState<"COMPACT" | "STANDARD">("COMPACT");
  const [hoveredBenchNumber, setHoveredBenchNumber] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Calculate sequential roll order rank for each candidate matching actual arrangement flow
  const candidateSequenceMap = useMemo(() => {
    const map = new Map<string, number>();
    let seq = 1;
    const direction = matrix.arrangementDirection || "COLUMN_WISE";
    const sortedBenches = [...matrix.benches].sort((a, b) => {
      const rowA = a.rowIndex ?? Math.floor((a.benchNumber - 1) / 4) + 1;
      const rowB = b.rowIndex ?? Math.floor((b.benchNumber - 1) / 4) + 1;
      const colA = a.colIndex ?? (((a.benchNumber - 1) % 4) + 1);
      const colB = b.colIndex ?? (((b.benchNumber - 1) % 4) + 1);

      if (direction === "COLUMN_WISE") {
        if (colA !== colB) return colA - colB;
        return rowA - rowB;
      } else if (direction === "ROW_WISE") {
        if (rowA !== rowB) return rowA - rowB;
        return colA - colB;
      } else if (direction === "SNAKE_COLUMN") {
        if (colA !== colB) return colA - colB;
        return colA % 2 === 0 ? rowB - rowA : rowA - rowB;
      } else if (direction === "SNAKE_ROW") {
        if (rowA !== rowB) return rowA - rowB;
        return rowA % 2 === 0 ? colB - colA : colA - colB;
      }
      return a.benchNumber - b.benchNumber;
    });

    sortedBenches.forEach((b) => {
      if (b.seat1) {
        map.set(b.seat1.id, seq++);
      }
      if (b.seat2 && !b.isSemSingleSeater && !isSemExam) {
        map.set(b.seat2.id, seq++);
      }
    });
    return map;
  }, [matrix.benches, matrix.arrangementDirection, isSemExam]);

  // Handle student click to open inspector with bench partner info
  const handleStudentClick = (
    student: StudentAllocation,
    partner?: StudentAllocation
  ) => {
    if (!interactive) return;
    setSelectedStudent(student);
    setSelectedBenchPartner(partner || null);
  };

  // Quick toggle attendance directly from 2D seat
  const handleToggleAttendance = (e: React.MouseEvent, allocation: StudentAllocation) => {
    e.stopPropagation();
    if (!interactive || !onUpdateAttendance) return;
    const newStatus = allocation.isPresent === false;
    onUpdateAttendance(allocation.id, newStatus);
    allocation.isPresent = newStatus;
  };

  // Export hall seating chart to CSV roster
  const handleExportCSV = () => {
    const rows = [
      ["Room", "Block", "Desk Number", "Seat Number", "Student Roll", "Student Name", "Branch", "Subject", "Attendance"]
    ];
    matrix.benches.forEach((bench) => {
      if (bench.seat1) {
        rows.push([
          matrix.roomNumber,
          matrix.block,
          String(bench.benchNumber),
          "Seat 01",
          bench.seat1.studentRoll,
          bench.seat1.studentName,
          bench.seat1.departmentCode,
          bench.seat1.subjectCode || "",
          bench.seat1.isPresent !== false ? "Present" : "Absent"
        ]);
      }
      if (bench.seat2 && !bench.isSemSingleSeater && !isSemExam) {
        rows.push([
          matrix.roomNumber,
          matrix.block,
          String(bench.benchNumber),
          "Seat 02",
          bench.seat2.studentRoll,
          bench.seat2.studentName,
          bench.seat2.departmentCode,
          bench.seat2.subjectCode || "",
          bench.seat2.isPresent !== false ? "Present" : "Absent"
        ]);
      }
    });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Room_${matrix.roomNumber}_Seating_Roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Render a Single 2D Physical Bench Card with Chairs & Desk Details
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

    const seat1Theme = bench.seat1 ? (BRANCH_THEMES[bench.seat1.departmentCode] || DEFAULT_BRANCH_THEME) : DEFAULT_BRANCH_THEME;
    const seat2Theme = bench.seat2 ? (BRANCH_THEMES[bench.seat2.departmentCode] || DEFAULT_BRANCH_THEME) : DEFAULT_BRANCH_THEME;

    const isHovered = hoveredBenchNumber === bench.benchNumber;
    // Neighbour check when hovered
    const isNeighbour =
      hoveredBenchNumber !== null &&
      Math.abs(hoveredBenchNumber - bench.benchNumber) === 1;

    return (
      <div
        key={bench.benchNumber}
        onMouseEnter={() => setHoveredBenchNumber(bench.benchNumber)}
        onMouseLeave={() => setHoveredBenchNumber(null)}
        className={cn(
          "relative flex flex-col items-center transition-all duration-200 group/bench select-none",
          isBenchHighlighted && "z-20 scale-[1.03]",
          isHovered && "z-20 scale-[1.02]",
          isNeighbour && showAntiCheatingRadar && "ring-2 ring-emerald-400/80 rounded-2xl"
        )}
      >
        {/* Animated Radar Pulse when matched in Search */}
        {isBenchHighlighted && (
          <span className="absolute -inset-2 rounded-2xl bg-blue-500/25 animate-ping pointer-events-none z-0" />
        )}

        {/* 2D Ergonomic Chairs Behind the Desk */}
        <div className="w-full flex justify-around px-4 -mb-2 z-0">
          {/* Seat 1 Chair Backrest */}
          <div
            className={cn(
              "w-11 h-4 rounded-t-lg border shadow-2xs transition-transform duration-150 flex items-center justify-center",
              blueprintMode
                ? bench.seat1
                  ? "bg-cyan-900 border-cyan-400 text-[8px] text-cyan-200 font-mono"
                  : "bg-slate-800 border-dashed border-cyan-800"
                : bench.seat1
                ? `${seat1Theme.chairBg} ${seat1Theme.chairBorder}`
                : "bg-slate-300 border-slate-400 opacity-60",
              "group-hover/bench:-translate-y-0.5"
            )}
            title={bench.seat1 ? `Seat 01: ${bench.seat1.studentName} (${bench.seat1.studentRoll})` : "Seat 01: Unoccupied"}
          >
            {blueprintMode && <span className="text-[7px] font-mono text-cyan-300">C1</span>}
          </div>

          {/* Seat 2 Chair Backrest */}
          {bench.isSemSingleSeater || isSemExam ? (
            <div
              className={cn(
                "w-11 h-4 rounded-t-lg border border-dashed flex items-center justify-center",
                blueprintMode
                  ? "border-cyan-800/60 bg-cyan-950/40 text-[7px] text-cyan-500 font-mono"
                  : "border-purple-300 bg-purple-100/60 opacity-70"
              )}
              title="Seat 02: Semester Single-Seater Buffer Zone"
            >
              <span className="text-[7px] font-mono opacity-80">BUFFER</span>
            </div>
          ) : (
            <div
              className={cn(
                "w-11 h-4 rounded-t-lg border shadow-2xs transition-transform duration-150 flex items-center justify-center",
                blueprintMode
                  ? bench.seat2
                    ? "bg-cyan-900 border-cyan-400 text-[8px] text-cyan-200 font-mono"
                    : "bg-slate-800 border-dashed border-cyan-800"
                  : bench.seat2
                  ? `${seat2Theme.chairBg} ${seat2Theme.chairBorder}`
                  : "bg-slate-300 border-slate-400 opacity-60",
                "group-hover/bench:-translate-y-0.5"
              )}
              title={bench.seat2 ? `Seat 02: ${bench.seat2.studentName} (${bench.seat2.studentRoll})` : "Seat 02: Unoccupied"}
            >
              {blueprintMode && <span className="text-[7px] font-mono text-cyan-300">C2</span>}
            </div>
          )}
        </div>

        {/* 2D Examination Desk Top Surface */}
        <div
          className={cn(
            "w-full rounded-2xl border transition-all shadow-sm flex flex-col justify-start overflow-hidden relative z-10",
            blueprintMode
              ? "bg-[#0b192e]/95 border-cyan-500/70 shadow-cyan-900/20"
              : "bg-gradient-to-b from-amber-50/40 via-white/80 to-slate-50/90 backdrop-blur-xl border-slate-200/90",
            isBenchHighlighted
              ? "ring-3 ring-blue-600 shadow-xl border-blue-500"
              : showAntiCheatingRadar && isMixed
              ? "border-emerald-400 ring-2 ring-emerald-400/50 shadow-md"
              : "hover:border-slate-400 hover:shadow-md"
          )}
        >
          {/* Desk Header Trim with Engraved Desk Number & Coordinates */}
          <div
            className={cn(
              "px-3 py-1.5 border-b flex items-center justify-between text-xs",
              blueprintMode
                ? "bg-cyan-950/80 border-cyan-800/80 text-cyan-200 font-mono"
                : "bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border-slate-200/80"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold tracking-tight text-[11px] flex items-center gap-1.5 text-slate-900">
                <span className={cn("h-2 w-2 rounded-full", blueprintMode ? "bg-cyan-400" : "bg-blue-600")} />
                DESK {String(bench.benchNumber).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded-md border font-bold shadow-2xs",
                  blueprintMode
                    ? "bg-cyan-900/60 border-cyan-700 text-cyan-300"
                    : "bg-slate-100 border-slate-200 text-slate-700"
                )}
              >
                R{bench.rowIndex ?? Math.floor((bench.benchNumber - 1) / 4) + 1}·C{bench.colIndex ?? (((bench.benchNumber - 1) % 4) + 1)}
              </span>
            </div>

            {/* Mixing Badge / Anti-Cheating Compliance Status */}
            {bench.isSemSingleSeater || isSemExam ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                <ShieldCheck className="h-3 w-3 text-purple-600" />
                <span>Single-Seater</span>
              </span>
            ) : isMixed ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>Mixed</span>
              </span>
            ) : bench.seat1 && bench.seat2 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                <span>Same Branch</span>
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400">Empty</span>
            )}
          </div>

          {/* Dual Candidate Workspaces with Wood Divider Line */}
          <div className="p-2 grid grid-cols-2 gap-2 relative flex-1 min-h-[108px]">
            {/* Center Separation Groove */}
            <div
              className={cn(
                "absolute top-1.5 bottom-1.5 left-1/2 -translate-x-1/2 w-0.5 rounded-full pointer-events-none",
                blueprintMode
                  ? "bg-cyan-700/60"
                  : "bg-gradient-to-b from-slate-200 via-slate-300 to-slate-200"
              )}
            />

            {/* Seat 1 (Left Candidate Slip) */}
            <CandidateDeskSlip
              seatNumber={1}
              allocation={bench.seat1}
              isHighlighted={Boolean(isSeat1Match)}
              isDimmed={Boolean(!seat1DeptMatches || !seat1AttMatches)}
              interactive={interactive}
              showSequenceFlow={showSequenceFlow}
              sequenceNumber={bench.seat1 ? candidateSequenceMap.get(bench.seat1.id) : undefined}
              blueprintMode={blueprintMode}
              onToggleAttendance={(e) => bench.seat1 && handleToggleAttendance(e, bench.seat1)}
              onClick={() => bench.seat1 && handleStudentClick(bench.seat1, bench.seat2)}
            />

            {/* Seat 2 (Right Candidate Slip or Single-Seater Buffer) */}
            {bench.isSemSingleSeater || isSemExam ? (
              <div
                className={cn(
                  "rounded-xl border-2 border-dashed p-2.5 flex flex-col items-center justify-center text-center select-none space-y-1",
                  blueprintMode
                    ? "border-cyan-800/80 bg-cyan-950/30 text-cyan-400"
                    : "border-purple-200 bg-purple-50/40 text-purple-900"
                )}
              >
                <ShieldCheck className="h-4 w-4 text-purple-600" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-tight">
                  Seat 02 Vacant
                </span>
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full border border-purple-200 bg-purple-100/80 text-purple-700">
                  Buffer Isolation
                </span>
              </div>
            ) : (
              <CandidateDeskSlip
                seatNumber={2}
                allocation={bench.seat2}
                isHighlighted={Boolean(isSeat2Match)}
                isDimmed={Boolean(!seat2DeptMatches || !seat2AttMatches)}
                interactive={interactive}
                showSequenceFlow={showSequenceFlow}
                sequenceNumber={bench.seat2 ? candidateSequenceMap.get(bench.seat2.id) : undefined}
                blueprintMode={blueprintMode}
                onToggleAttendance={(e) => bench.seat2 && handleToggleAttendance(e, bench.seat2)}
                onClick={() => bench.seat2 && handleStudentClick(bench.seat2, bench.seat1)}
              />
            )}
          </div>

          {/* Bottom Table Frame Accent */}
          <div
            className={cn(
              "h-1 w-full",
              blueprintMode
                ? "bg-cyan-800"
                : "bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200"
            )}
          />
        </div>
      </div>
    );
  };

  /**
   * Render a Compact Single Bench Card for Column / Dense views
   */
  const renderCompactBench = (bench: BenchAllocation) => {
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

    const seat1Theme = bench.seat1
      ? BRANCH_THEMES[bench.seat1.departmentCode] || DEFAULT_BRANCH_THEME
      : DEFAULT_BRANCH_THEME;
    const seat2Theme = bench.seat2
      ? BRANCH_THEMES[bench.seat2.departmentCode] || DEFAULT_BRANCH_THEME
      : DEFAULT_BRANCH_THEME;

    const isHovered = hoveredBenchNumber === bench.benchNumber;

    return (
      <div
        key={bench.benchNumber}
        onMouseEnter={() => setHoveredBenchNumber(bench.benchNumber)}
        onMouseLeave={() => setHoveredBenchNumber(null)}
        className={cn(
          "rounded-xl border transition-all duration-150 p-2 text-xs select-none",
          blueprintMode
            ? "bg-[#0b192e] border-cyan-800/80 text-cyan-100"
            : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs",
          isBenchHighlighted && "ring-2 ring-blue-600 shadow-md border-blue-500",
          isHovered && "scale-[1.01]"
        )}
      >
        {/* Header row: Desk #, Coordinates, and Mix/Single status */}
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 text-[10px] font-mono">
          <div className="flex items-center gap-1.5 font-bold">
            <span className={cn("h-1.5 w-1.5 rounded-full", blueprintMode ? "bg-cyan-400" : "bg-blue-600")} />
            <span>DESK {String(bench.benchNumber).padStart(2, "0")}</span>
            <span className="opacity-60 text-[9px]">
              (R{bench.rowIndex ?? Math.floor((bench.benchNumber - 1) / 4) + 1}·C{bench.colIndex ?? (((bench.benchNumber - 1) % 4) + 1)})
            </span>
          </div>

          {bench.isSemSingleSeater || isSemExam ? (
            <span className="text-[9px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
              Single-Seater
            </span>
          ) : isMixed ? (
            <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              Mixed
            </span>
          ) : bench.seat1 && bench.seat2 ? (
            <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              Same Branch
            </span>
          ) : (
            <span className="text-[9px] text-slate-400">Empty</span>
          )}
        </div>

        {/* Seat 1 and Seat 2 Compact Row */}
        <div className="grid grid-cols-2 gap-1.5">
          {/* Seat 1 */}
          {bench.seat1 ? (
            <div
              onClick={() => bench.seat1 && handleStudentClick(bench.seat1, bench.seat2)}
              className={cn(
                "p-1.5 rounded-lg border transition cursor-pointer flex flex-col justify-between min-h-[58px]",
                blueprintMode
                  ? "bg-cyan-950/60 border-cyan-800 text-cyan-200"
                  : `${seat1Theme.bg} ${seat1Theme.border}`,
                isSeat1Match && "ring-1 ring-blue-500 font-bold",
                Boolean(!seat1DeptMatches || !seat1AttMatches) && "opacity-30 grayscale"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[8.5px] font-mono opacity-60">S1</span>
                {showSequenceFlow && candidateSequenceMap.has(bench.seat1.id) && (
                  <span className="text-[8px] font-mono font-bold bg-blue-600 text-white px-1 rounded">
                    #{candidateSequenceMap.get(bench.seat1.id)}
                  </span>
                )}
                <span className={cn("text-[8px] font-bold px-1 rounded", seat1Theme.badge)}>
                  {bench.seat1.departmentCode}
                </span>
              </div>
              <div className="font-mono font-black text-[11px] truncate mt-0.5">
                {bench.seat1.studentRoll}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[9px] truncate max-w-[70px] opacity-80">
                  {bench.seat1.studentName}
                </span>
                <button
                  type="button"
                  onClick={(e) => bench.seat1 && handleToggleAttendance(e, bench.seat1)}
                  className={cn(
                    "text-[8px] font-bold px-1 rounded",
                    bench.seat1.isPresent !== false ? "text-emerald-700 bg-emerald-100" : "text-rose-700 bg-rose-100",
                    !interactive && "pointer-events-none"
                  )}
                  title="Toggle attendance"
                >
                  {bench.seat1.isPresent !== false ? "P" : "A"}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[9px] text-slate-400 font-mono min-h-[58px]">
              S1: Empty
            </div>
          )}

          {/* Seat 2 or Buffer */}
          {bench.isSemSingleSeater || isSemExam ? (
            <div className="p-1.5 rounded-lg border border-dashed border-purple-200 bg-purple-50/50 flex flex-col items-center justify-center text-center min-h-[58px]">
              <span className="text-[9px] font-mono font-bold text-purple-700">S2 Buffer</span>
              <span className="text-[8px] text-purple-500">Vacant</span>
            </div>
          ) : bench.seat2 ? (
            <div
              onClick={() => bench.seat2 && handleStudentClick(bench.seat2, bench.seat1)}
              className={cn(
                "p-1.5 rounded-lg border transition cursor-pointer flex flex-col justify-between min-h-[58px]",
                blueprintMode
                  ? "bg-cyan-950/60 border-cyan-800 text-cyan-200"
                  : `${seat2Theme.bg} ${seat2Theme.border}`,
                isSeat2Match && "ring-1 ring-blue-500 font-bold",
                Boolean(!seat2DeptMatches || !seat2AttMatches) && "opacity-30 grayscale"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[8.5px] font-mono opacity-60">S2</span>
                {showSequenceFlow && candidateSequenceMap.has(bench.seat2.id) && (
                  <span className="text-[8px] font-mono font-bold bg-blue-600 text-white px-1 rounded">
                    #{candidateSequenceMap.get(bench.seat2.id)}
                  </span>
                )}
                <span className={cn("text-[8px] font-bold px-1 rounded", seat2Theme.badge)}>
                  {bench.seat2.departmentCode}
                </span>
              </div>
              <div className="font-mono font-black text-[11px] truncate mt-0.5">
                {bench.seat2.studentRoll}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[9px] truncate max-w-[70px] opacity-80">
                  {bench.seat2.studentName}
                </span>
                <button
                  type="button"
                  onClick={(e) => bench.seat2 && handleToggleAttendance(e, bench.seat2)}
                  className={cn(
                    "text-[8px] font-bold px-1 rounded",
                    bench.seat2.isPresent !== false ? "text-emerald-700 bg-emerald-100" : "text-rose-700 bg-rose-100",
                    !interactive && "pointer-events-none"
                  )}
                  title="Toggle attendance"
                >
                  {bench.seat2.isPresent !== false ? "P" : "A"}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[9px] text-slate-400 font-mono min-h-[58px]">
              S2: Empty
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-5", isFullscreen && "fixed inset-0 z-50 bg-slate-900/90 p-4 sm:p-8 overflow-y-auto backdrop-blur-md")}>
      {/* ── Top Controls & Statistics Banner ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl border border-slate-200/80 text-slate-900 p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-blue-600 text-white text-xs font-bold tracking-wide uppercase shadow-xs">
              Room {matrix.roomNumber}
            </span>
            <span className="text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200">
              Block {matrix.block}
            </span>
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
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              {sameBranchCount === 0 ? "100% Collision-Free" : `${sameBranchCount} Branch Collisions`}
            </span>
          </div>

          <h2 className="text-xl font-black mt-2 text-slate-900 tracking-tight flex items-center gap-2">
            <span>2D Hall Seating Architecture & Interactive Model</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono font-bold">
              v2.0 Enhanced
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSemExam
              ? `Architectural Floorplan • Single Candidate Per Desk • ${matrix.allocatedCount} Candidates (${totalBenches} Desks × 1 Seat)`
              : `Architectural Floorplan • Dual Candidates Per Desk • ${matrix.capacity} Capacity (${totalBenches} Desks × 2 Seats)`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Blueprint Mode Toggle */}
          <button
            onClick={() => setBlueprintMode((prev) => !prev)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs",
              blueprintMode
                ? "bg-cyan-900 text-cyan-200 border-cyan-600 shadow-cyan-900/30"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
            title="Toggle CAD Architectural Blueprint Mode"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Blueprint CAD</span>
          </button>

          {/* Fullscreen Focus Toggle */}
          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Projection Mode"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Expand"}</span>
          </button>

          {/* View Mode Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shadow-2xs w-full sm:w-auto">
            <button
              onClick={() => setViewMode("GRID")}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs touch-target sm:touch-auto",
                viewMode === "GRID"
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
              title="Classroom 2D Floorplan (4 Columns × 6 Rows)"
            >
              <Grid3X3 className="h-3.5 w-3.5" />
              <span>Hall Canvas</span>
            </button>
            <button
              onClick={() => setViewMode("COLUMN_WISE")}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs touch-target sm:touch-auto",
                viewMode === "COLUMN_WISE"
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200"
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
                "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs touch-target sm:touch-auto",
                viewMode === "ROW_WISE"
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
              title="View Row by Row"
            >
              <Rows className="h-3.5 w-3.5" />
              <span>Rows</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <button
              onClick={() => setZoomLevel((z) => Math.max(75, z - 15))}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition touch-target sm:touch-auto flex items-center justify-center"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-[11px] font-bold text-slate-700 px-2 min-w-[42px] text-center">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(135, z + 15))}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition touch-target sm:touch-auto flex items-center justify-center"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            {zoomLevel !== 100 && (
              <button
                onClick={() => setZoomLevel(100)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition border-l border-slate-200 ml-0.5 touch-target sm:touch-auto flex items-center justify-center"
                title="Reset Zoom"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-auto flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Locate roll # or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-7 py-1.5 text-xs bg-white text-slate-900 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-44 shadow-2xs transition"
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

          {/* Print & CSV Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => window.print()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition touch-target sm:touch-auto"
              title="Print Hall Door Notice"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span className="sm:inline">Print</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition touch-target sm:touch-auto"
              title="Export Candidate Seating Roster as CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span className="sm:inline">CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Interactive Filters, Toggles & Visual Overlays Ribbon ── */}
      <div className="p-3.5 rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Branch Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" /> Filter:
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
            All Branches ({totalOccupied})
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
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
                <span>{dept}</span>
                <span className="text-[10px] font-mono opacity-85">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Visual Overlay Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Anti-Cheating Radar Toggle */}
          <button
            onClick={() => setShowAntiCheatingRadar((prev) => !prev)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition shadow-2xs",
              showAntiCheatingRadar
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
            )}
            title="Highlight branch separation between neighbouring candidates"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Anti-Cheating Radar</span>
          </button>

          {/* Seating Flow Sequence Toggle */}
          <button
            onClick={() => setShowSequenceFlow((prev) => !prev)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition shadow-2xs",
              showSequenceFlow
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
            )}
            title="Display candidate seating sequence order"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Sequence Order</span>
          </button>

          {/* Live Attendance Indicators */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
            <button
              onClick={() =>
                setAttendanceFilter((curr) => (curr === "PRESENT" ? "ALL" : "PRESENT"))
              }
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition",
                attendanceFilter === "PRESENT"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
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
                "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition",
                attendanceFilter === "ABSENT"
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <span>Absent: {absentCount}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Physical Architectural Room Shell Canvas ── */}
      <div
        ref={containerRef}
        className={cn(
          "rounded-3xl border-2 p-4 sm:p-6 shadow-md space-y-4 overflow-hidden",
          blueprintMode
            ? "bg-[#071527] border-cyan-600/60 text-cyan-100 shadow-2xl relative"
            : "border-slate-300/80 bg-gradient-to-b from-slate-100/70 via-slate-50/50 to-slate-100/70"
        )}
        style={
          zoomLevel !== 100
            ? ({
                zoom: `${zoomLevel}%`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {/* Architectural Blueprint Grid Backdrop Effect */}
        {blueprintMode && (
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: "linear-gradient(to right, #00ffff 1px, transparent 1px), linear-gradient(to bottom, #00ffff 1px, transparent 1px)",
              backgroundSize: "32px 32px"
            }}
          />
        )}

        {/* 1. FRONT PODIUM & BLACKBOARD (Architectural Elevation) */}
        <div
          className={cn(
            "relative rounded-2xl p-4 shadow-lg border overflow-hidden",
            blueprintMode
              ? "bg-[#0a1e38] border-cyan-500/80 text-cyan-100"
              : "bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white border-slate-700"
          )}
        >
          {/* Top Border Accent simulating Blackboard wooden rail */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-10 w-10 rounded-xl border flex items-center justify-center shadow-inner",
                  blueprintMode
                    ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                    : "bg-slate-800 border-slate-700 text-teal-400"
                )}
              >
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 font-mono text-xs font-black tracking-widest uppercase text-slate-100">
                  <span>▲ FRONT OF EXAMINATION HALL ▲</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-normal border border-emerald-500/30">
                    BLACKBOARD & PODIUM
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Invigilator Station • Room {matrix.roomNumber} (Block {matrix.block}) • Autonomous Cell
                </p>
              </div>
            </div>

            {/* Invigilator Physical Desk Simulation */}
            <div
              className={cn(
                "flex items-center gap-3 border px-3.5 py-1.5 rounded-xl shadow-inner text-xs font-mono",
                blueprintMode
                  ? "bg-cyan-950/90 border-cyan-700 text-cyan-200"
                  : "bg-slate-800/80 border-slate-700/80 text-slate-300"
              )}
            >
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                <Clock className="h-3.5 w-3.5" />
                <span>Session Live</span>
              </div>
              <span className="text-slate-600">|</span>
              <span className="text-[11px]">
                Desk #00: Chief Invigilator
              </span>
            </div>
          </div>
        </div>

        {/* 2. Hall Entry Doorway & Corridor Navigation Radar */}
        <div
          className={cn(
            "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-xs shadow-2xs",
            blueprintMode
              ? "bg-[#091b33] border-cyan-800 text-cyan-200"
              : "bg-white border-slate-200/90 text-slate-700"
          )}
        >
          {/* Main Entry Door with CAD Swing Arc */}
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 font-bold text-blue-900 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 font-mono text-xs shadow-2xs">
              <DoorOpen className="h-4 w-4 text-blue-600" />
              <span>MAIN ENTRANCE DOOR</span>
            </span>
            <span className="text-slate-500 text-[11px] font-medium hidden md:inline">
              ← Candidate entry & barcode scanning station (Door Swing Radius: 90°)
            </span>
          </div>

          {/* Walking Aisles Guide */}
          <div className="flex items-center gap-3 text-[11px] font-mono font-bold overflow-x-auto">
            <span className="opacity-60 hidden lg:inline">Corridors:</span>
            <span className={cn("px-2 py-0.5 rounded", blueprintMode ? "bg-cyan-950 text-cyan-300 border border-cyan-800" : "bg-slate-100 text-slate-700")}>
              Aisle 1 (Left • 1.2m)
            </span>
            <span className="opacity-40">•</span>
            <span className={cn("px-2 py-0.5 rounded", blueprintMode ? "bg-cyan-950 text-cyan-300 border border-cyan-800" : "bg-slate-100 text-slate-700")}>
              Center Main Aisle (1.5m)
            </span>
            <span className="opacity-40">•</span>
            <span className={cn("px-2 py-0.5 rounded", blueprintMode ? "bg-cyan-950 text-cyan-300 border border-cyan-800" : "bg-slate-100 text-slate-700")}>
              Aisle 3 (Window • 1.2m)
            </span>
          </div>
        </div>

        {/* 3. View Mode 1: COMPLETE HALL CANVAS (4 Columns × 6 Rows) */}
        {viewMode === "GRID" && (
          <div className="overflow-x-auto pb-4 no-scrollbar md:scrollbar">
            {/* Mobile Touch Navigation Notice */}
            <div className="md:hidden text-center text-[11px] text-blue-700 bg-blue-50 border border-blue-200 py-1.5 px-3 rounded-xl mb-3 flex items-center justify-center gap-1.5 font-semibold">
              <span>← Swipe horizontally to view all 4 columns (or tap &apos;Columns&apos; tab above) →</span>
            </div>
            <div className="min-w-[780px] space-y-4">
              {/* Column Lane Guides Aligned with Desks */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 sm:w-14 shrink-0 text-center font-mono text-[10px] font-extrabold opacity-60 uppercase tracking-wider">
                  ROW
                </div>
                <div className="flex-1 grid grid-cols-4 gap-3 sm:gap-4 text-center font-mono text-[11px] font-black">
                  {[
                    { title: "COLUMN 1", sub: "Aisle Left (D01, D05..D21)" },
                    { title: "COLUMN 2", sub: "Center-L (D02, D06..D22)" },
                    { title: "COLUMN 3", sub: "Center-R (D03, D07..D23)" },
                    { title: "COLUMN 4", sub: "Window (D04, D08..D24)" },
                  ].map((col, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "py-2 rounded-xl border shadow-2xs flex items-center justify-center gap-1.5",
                        blueprintMode
                          ? "bg-cyan-950/70 border-cyan-700 text-cyan-200"
                          : "bg-slate-200/70 border-slate-300/80 text-slate-700"
                      )}
                    >
                      <span>{col.title}</span>
                      {showSequenceFlow ? (
                        <span className="flex items-center text-[10px] text-blue-600 font-bold bg-blue-100 px-1 rounded">
                          <ArrowDown className="h-3 w-3 inline" /> Flow
                        </span>
                      ) : (
                        <span className="font-normal text-[10px] opacity-70 hidden sm:inline">({col.sub})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 6 Rows of Benches with Physical Row Markers */}
              {[1, 2, 3, 4, 5, 6].map((rowNum) => {
                const rowBenches = [1, 2, 3, 4].map((colNum) => {
                  return matrix.benches.find(
                    (b) =>
                      (b.rowIndex ?? Math.floor((b.benchNumber - 1) / 4) + 1) === rowNum &&
                      (b.colIndex ?? (((b.benchNumber - 1) % 4) + 1)) === colNum
                  );
                });

                return (
                  <div key={rowNum} className="flex items-stretch gap-3 sm:gap-4 relative">
                    {/* Row Badge on Left */}
                    <div
                      className={cn(
                        "w-12 sm:w-14 shrink-0 rounded-2xl border flex flex-col items-center justify-center p-1.5 text-center shadow-xs",
                        blueprintMode
                          ? "bg-cyan-950/90 border-cyan-700 text-cyan-300"
                          : "bg-gradient-to-b from-slate-100 to-slate-200 border-slate-300/90 text-slate-900"
                      )}
                    >
                      <span className="text-xs font-black font-mono">
                        R{rowNum}
                      </span>
                      <span className="text-[8px] font-mono opacity-70 uppercase font-bold tracking-tight">
                        Row {rowNum}
                      </span>
                    </div>

                    {/* 4 Physical Benches in this Row */}
                    <div className="flex-1 grid grid-cols-4 gap-3 sm:gap-4">
                      {rowBenches.map((bench, idx) =>
                        bench ? (
                          renderBench(bench)
                        ) : (
                          <div
                            key={idx}
                            className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-4 flex flex-col items-center justify-center text-xs text-slate-400 font-mono min-h-[140px]"
                          >
                            <span>EMPTY DESK</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}

              {/* REAR OF EXAMINATION HALL • CCTV RADAR & EXIT */}
              <div
                className={cn(
                  "pt-4 border-t-2 border-dashed flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono px-2",
                  blueprintMode
                    ? "border-cyan-800 text-cyan-300"
                    : "border-slate-300 text-slate-500"
                )}
              >
                <div className="flex items-center gap-2 font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                  <Video className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                  <span>CCTV SURVEILLANCE RADAR ACTIVE (360° ANTI-MALPRACTICE)</span>
                </div>

                <div className="text-[11px] font-bold opacity-60 tracking-wider uppercase">
                  ▼ REAR OF EXAMINATION HALL • BACK EXIT AISLE ▼
                </div>

                <div className="flex items-center gap-2 font-bold">
                  <span>🧯 Fire Safety Station</span>
                  <span>•</span>
                  <span>Exit Door B (Clearance 1.5m)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. View Mode 2: VERTICAL COLUMN LANES */}
        {viewMode === "COLUMN_WISE" && (
          <div className="space-y-3">
            {/* Sub-header for Column View with Density Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <span className="text-slate-600 text-xs font-medium">
                Vertical column lanes with aisle flow • All 4 columns displayed side-by-side
              </span>
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl border border-slate-300/80 text-xs self-start sm:self-auto shadow-2xs">
                <button
                  onClick={() => setColumnDensity("COMPACT")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition",
                    columnDensity === "COMPACT"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                  title="Compact height cards: All 6 desks fit in a single view"
                >
                  Compact Lanes (Single View)
                </button>
                <button
                  onClick={() => setColumnDensity("STANDARD")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition",
                    columnDensity === "STANDARD"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                  title="Full 2D desks with internal scroll"
                >
                  Architectural Desks
                </button>
              </div>
            </div>

            {/* Horizontal Scroll wrapper guaranteeing 4 columns stay side by side without wrapping into 2 rows */}
            <div className="overflow-x-auto pb-3">
              <div className="grid grid-cols-4 min-w-[780px] gap-3">
                {[1, 2, 3, 4].map((colNum) => {
                  const colBenches = matrix.benches
                    .filter((b) => (b.colIndex ?? (((b.benchNumber - 1) % 4) + 1)) === colNum)
                    .sort((a, b) => {
                      const rowA = a.rowIndex ?? Math.floor((a.benchNumber - 1) / 4) + 1;
                      const rowB = b.rowIndex ?? Math.floor((b.benchNumber - 1) / 4) + 1;
                      return rowA - rowB;
                    });

                  const deskRangeStr =
                    colBenches.length > 0
                      ? `D${String(colBenches[0].benchNumber).padStart(2, "0")}..D${String(
                          colBenches[colBenches.length - 1].benchNumber
                        ).padStart(2, "0")}`
                      : "";

                  return (
                    <div
                      key={colNum}
                      className={cn(
                        "rounded-2xl border p-3 shadow-xs flex flex-col justify-start space-y-2.5",
                        blueprintMode
                          ? "bg-[#091b33] border-cyan-800"
                          : "bg-white/80 border-slate-200"
                      )}
                    >
                      {/* Sticky Column Header */}
                      <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 text-white text-center shadow-xs shrink-0">
                        <div className="text-xs font-black tracking-wide uppercase flex items-center justify-center gap-1.5">
                          <span>Column {colNum}</span>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </div>
                        <div className="text-[10px] text-blue-100 font-medium mt-0.5">
                          {colNum === 1
                            ? "Left Aisle"
                            : colNum === 2
                            ? "Center Left"
                            : colNum === 3
                            ? "Center Right"
                            : "Right Window"}{" "}
                          • {colBenches.length} Desks ({deskRangeStr})
                        </div>
                      </div>

                      {/* Benches in Column */}
                      {colBenches.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-[11px] text-slate-400 font-mono">
                          No desks in this column
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "w-full",
                            columnDensity === "COMPACT"
                              ? "space-y-2"
                              : "space-y-3 max-h-[640px] overflow-y-auto pr-1 scrollbar-thin"
                          )}
                        >
                          {colBenches.map((bench) =>
                            columnDensity === "COMPACT"
                              ? renderCompactBench(bench)
                              : renderBench(bench)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 5. View Mode 3: HORIZONTAL ROW STRIPS */}
        {viewMode === "ROW_WISE" && (
          <div className="space-y-3 overflow-x-auto pb-3">
            <div className="min-w-[780px] space-y-3">
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
                    className={cn(
                      "rounded-3xl border p-4 sm:p-5 space-y-3 shadow-sm",
                      blueprintMode
                        ? "bg-[#091b33] border-cyan-800"
                        : "bg-white/80 border-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-xl bg-blue-700 text-white font-mono text-xs font-bold shadow-xs">
                          ROW {rowNum}
                        </span>
                        <span className="text-xs font-bold">
                          {rowNum === 1 ? "Front Row (Near Teacher Podium)" : rowNum === 6 ? "Rear Row (Back Aisle)" : `Row ${rowNum} Desks`}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                      </div>
                      <span className="text-[11px] font-mono opacity-70 font-semibold">
                        {rowBenches.length} Desks • {rowBenches.length * (isSemExam ? 1 : 2)} Allocated Seats
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-3 sm:gap-4">
                      {rowBenches.map((bench) => renderBench(bench))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Candidate Inspector Modal with Bench Partner Verification ── */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
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
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Candidate Metadata Breakdown */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Branch</span>
                <span className="font-bold text-slate-800 mt-0.5 inline-block">
                  {selectedStudent.departmentCode} ({selectedStudent.semester ? `Sem ${selectedStudent.semester}` : "Engineering"})
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Exam Subject</span>
                <span className="font-bold text-slate-800 mt-0.5 inline-block">
                  {selectedStudent.subjectCode || "Registered Paper"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Hall Location</span>
                <span className="font-mono font-bold text-slate-800 mt-0.5 inline-block">
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
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Neighbour Separation
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                    Zero Collision
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-emerald-200/60 flex items-center justify-between">
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
                  ✓ Verified: Sitting neighbour belongs to a distinct branch / writes a distinct question paper.
                </p>
              </div>
            ) : isSemExam ? (
              <div className="p-3.5 rounded-2xl bg-purple-50/80 border border-purple-200/90 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-purple-950 text-[11px]">
                  <ShieldCheck className="h-4 w-4 text-purple-600" /> Semester Policy: Single-Seater
                </div>
                <p className="text-[10px] text-purple-800 leading-tight">
                  This desk accommodates strictly 1 candidate (Seat 01). Seat 02 remains vacant to guarantee examination isolation.
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
 * 2D Examination Desk Slip (Placed on Desk Top)
 */
function CandidateDeskSlip({
  seatNumber,
  allocation,
  isHighlighted,
  isDimmed,
  interactive,
  showSequenceFlow,
  sequenceNumber,
  blueprintMode,
  onToggleAttendance,
  onClick,
}: {
  seatNumber: 1 | 2;
  allocation?: StudentAllocation;
  isHighlighted: boolean;
  isDimmed: boolean;
  interactive: boolean;
  showSequenceFlow?: boolean;
  sequenceNumber?: number;
  blueprintMode?: boolean;
  onToggleAttendance?: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  if (!allocation) {
    return (
      <div
        className={cn(
          "h-24 rounded-xl border border-dashed flex flex-col items-center justify-center p-2 text-center",
          blueprintMode
            ? "border-cyan-800/60 bg-cyan-950/20 text-cyan-500"
            : "border-slate-300 bg-slate-50/50 text-slate-400"
        )}
      >
        <span className="text-[9px] font-mono font-semibold uppercase">
          Seat 0{seatNumber} ({seatNumber === 1 ? "L" : "R"})
        </span>
        <span className="text-[10px] italic mt-0.5">Vacant Seat</span>
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
        blueprintMode
          ? "bg-cyan-950/70 border-cyan-600/60 text-cyan-100 hover:border-cyan-400"
          : `${theme.bg} ${theme.border}`,
        "hover:scale-[1.03] hover:shadow-md",
        isHighlighted && "ring-2 ring-blue-600 shadow-md font-bold scale-[1.02]",
        isDimmed && "opacity-30 grayscale-[70%]",
        isAbsent && "opacity-60 grayscale-[40%]"
      )}
    >
      {/* Top row: Seat Label & Department Badge & Sequence Tag */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono font-bold uppercase tracking-tighter opacity-70">
            S0{seatNumber}
          </span>
          {showSequenceFlow && sequenceNumber && (
            <span className="text-[8px] font-mono font-black px-1 rounded bg-blue-600 text-white shadow-2xs">
              #{sequenceNumber}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {allocation.subjectCode && (
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-white">
              {allocation.subjectCode}
            </span>
          )}
          <span className={cn("text-[9px] font-extrabold px-1.5 py-0.5 rounded-md", theme.badge)}>
            {allocation.departmentCode}
          </span>
        </div>
      </div>

      {/* Middle row: Roll number & Name */}
      <div className="my-auto">
        <div className="font-mono text-xs font-bold tracking-wider truncate text-slate-900 group-hover:text-blue-600 transition">
          {allocation.studentRoll}
        </div>
        <div className="text-[10px] font-medium opacity-85 truncate leading-tight mt-0.5">
          {allocation.studentName}
        </div>
      </div>

      {/* Bottom row: Attendance Indicator with Quick-Click Toggle */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 text-[9px]">
        <button
          type="button"
          onClick={onToggleAttendance}
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-md transition font-mono",
            isAbsent
              ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100",
            !interactive && "pointer-events-none"
          )}
          title={interactive ? "Click to toggle attendance (Present/Absent)" : undefined}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isAbsent ? "bg-rose-500" : "bg-emerald-500"
            )}
          />
          <span className="font-bold text-[9px] tracking-tight">
            {isAbsent ? "ABSENT" : "PRESENT"}
          </span>
        </button>

        <span className="text-[9px] opacity-60 group-hover:opacity-100 group-hover:text-blue-600 font-semibold transition flex items-center gap-0.5">
          <Eye className="h-2.5 w-2.5 inline" />
          <span>Details</span>
        </span>
      </div>
    </div>
  );
}
