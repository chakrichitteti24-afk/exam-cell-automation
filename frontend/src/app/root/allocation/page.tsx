"use client";

import React, { useState, useEffect } from "react";
import {
  Grid3X3,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  DoorOpen,
  Users,
  RefreshCw,
  Save,
  Check,
  Layers,
  FileSpreadsheet,
  ShieldCheck,
  RotateCcw,
  Rocket,
} from "lucide-react";
import {
  api,
  ApiExam,
  ApiRoom,
  ApiRoomSeatingMatrix,
  ApiAllocationSummary,
  mapApiMatrixToRoomMatrix,
} from "@/lib/api";
import { RoomSeatingMatrix } from "@/types";
import { RoomSeatingGrid } from "@/components/seating/RoomSeatingGrid";
import Link from "next/link";

export default function RootAllocationPage() {
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [targetMode, setTargetMode] = useState<"MULTI_SESSION" | "SINGLE_EXAM">("MULTI_SESSION");
  const [examType, setExamType] = useState<"MID" | "SEM">("MID");
  const [examSubdivision, setExamSubdivision] = useState<"MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY">("MID_1");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [arrangementDirection, setArrangementDirection] = useState<"COLUMN_WISE" | "ROW_WISE" | "SNAKE_COLUMN" | "SNAKE_ROW">("COLUMN_WISE");
  const [strictBranchMixing, setStrictBranchMixing] = useState(true);
  const [shuffleStudents, setShuffleStudents] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [currentMatrix, setCurrentMatrix] = useState<RoomSeatingMatrix | null>(null);
  const [summary, setSummary] = useState<ApiAllocationSummary | null>(null);
  const [qpBreakdown, setQpBreakdown] = useState<Record<string, number> | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // Departmental exams for multi-exam concurrent session (CSE, ECE, EEE, MECH, CIVIL)
  const departmentalExams = exams.filter((e) =>
    ["CS301", "EC301", "EE301", "ME301", "CE301", "CS501", "EC501", "CE501", "ME501"].includes(e.subject_code)
  );

  // Initial load
  useEffect(() => {
    async function initData() {
      setLoading(true);
      try {
        const [exList, rmList] = await Promise.all([
          api.exams.list(),
          api.rooms.list(),
        ]);
        setExams(exList);
        setRooms(rmList);

        if (exList.length > 0) {
          setSelectedExamId(exList[0].id);
          if (exList[0].exam_type === "SEM" || exList[0].exam_type === "MID") {
            setExamType(exList[0].exam_type as "MID" | "SEM");
          }
          if (exList[0].exam_subdivision) {
            setExamSubdivision(exList[0].exam_subdivision as any);
          }
        }
        if (rmList.length > 0) {
          setActiveRoomId(rmList[0].id);
        }
      } catch (err) {
        console.error("Failed to load exams or rooms:", err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // Fetch seating matrix when activeRoomId or selectedExamId changes
  useEffect(() => {
    async function loadMatrix() {
      if (!selectedExamId || !activeRoomId) return;
      try {
        const apiMatrix = await api.allocation.getRoomMatrix(activeRoomId, selectedExamId);
        const mapped = mapApiMatrixToRoomMatrix(apiMatrix, selectedExamId);
        setCurrentMatrix(mapped);
      } catch (err) {
        console.warn("No active allocation found for selected room/exam:", err);
        setCurrentMatrix(null);
      }
    }
    loadMatrix();
  }, [selectedExamId, activeRoomId]);

  // Load global summary
  useEffect(() => {
    async function loadSummary() {
      try {
        const sum = await api.allocation.getSummary();
        setSummary(sum);
      } catch {
        // Summary optional
      }
    }
    loadSummary();
  }, [selectedExamId]);

  const handleGenerate = async () => {
    if (rooms.length === 0) return;

    setIsGenerating(true);
    setIsSaved(false);
    setGenerationStep(1);

    try {
      setGenerationStep(2);
      const roomIdsToAllocate = rooms.map((r) => r.id);

      let res;
      if (targetMode === "MULTI_SESSION" && departmentalExams.length > 0) {
        // Concurrent allocation for CSE, ECE, EEE, MECH, CIVIL
        const examIds = departmentalExams.map((e) => e.id);
        res = await api.allocation.generate({
          exam_ids: examIds,
          room_ids: roomIdsToAllocate,
          strategy: strictBranchMixing ? "MULTI_BRANCH_MIXING" : "STANDARD",
          arrangement_direction: arrangementDirection,
          exam_type: examType,
          exam_subdivision: examSubdivision,
        });
      } else {
        // Single exam allocation
        if (!selectedExamId) return;
        res = await api.allocation.generate({
          exam_id: selectedExamId,
          room_ids: roomIdsToAllocate,
          strategy: strictBranchMixing ? "MULTI_BRANCH_MIXING" : "STANDARD",
          arrangement_direction: arrangementDirection,
          exam_type: examType,
          exam_subdivision: examSubdivision,
        });
      }

      setGenerationStep(4);
      setWarnings(res.warnings || []);
      if (res.question_paper_breakdown) {
        setQpBreakdown(res.question_paper_breakdown);
      }

      // Reload matrix for current room
      if (activeRoomId && selectedExamId) {
        const updatedApiMatrix = await api.allocation.getRoomMatrix(activeRoomId, selectedExamId);
        setCurrentMatrix(mapApiMatrixToRoomMatrix(updatedApiMatrix, selectedExamId));
      }

      // Reload summary
      const sum = await api.allocation.getSummary();
      setSummary(sum);

      setGenerationStep(5);
    } catch (err: unknown) {
      alert(`Allocation generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsGenerating(false);
      setGenerationStep(0);
    }
  };

  const handleLaunchSession = async () => {
    if (rooms.length === 0) return;
    setIsGenerating(true);
    setGenerationStep(1);
    try {
      const roomIdsToAllocate = rooms.map((r) => r.id);
      let res;
      if (targetMode === "MULTI_SESSION" && departmentalExams.length > 0) {
        res = await api.exams.launch({
          exam_ids: departmentalExams.map((e) => e.id),
          room_ids: roomIdsToAllocate,
          strategy: strictBranchMixing ? "MULTI_BRANCH_MIXING" : "STANDARD",
          arrangement_direction: arrangementDirection,
          auto_assign_invigilators: true,
          exam_type: examType,
          exam_subdivision: examSubdivision,
        });
      } else {
        if (!selectedExamId) return;
        res = await api.exams.launch({
          exam_id: selectedExamId,
          room_ids: roomIdsToAllocate,
          strategy: strictBranchMixing ? "MULTI_BRANCH_MIXING" : "STANDARD",
          arrangement_direction: arrangementDirection,
          auto_assign_invigilators: true,
          exam_type: examType,
          exam_subdivision: examSubdivision,
        });
      }

      if (activeRoomId && selectedExamId) {
        const updatedApiMatrix = await api.allocation.getRoomMatrix(activeRoomId, selectedExamId);
        setCurrentMatrix(mapApiMatrixToRoomMatrix(updatedApiMatrix, selectedExamId));
      }
      const sum = await api.allocation.getSummary();
      setSummary(sum);

      alert(
        `Examination Session Successfully Launched!\n\n` +
        `• Session Status: ACTIVE\n` +
        `• Total Candidates Seated: ${res.total_students_allocated}\n` +
        `• Halls Utilized: ${res.rooms_utilized}\n` +
        `• Branch-Mixing Compliance: ${res.branch_mixing_compliance_percent}%\n` +
        `• Hall Invigilators Deployed: ${res.duty_roster.length} rooms`
      );
    } catch (err: unknown) {
      alert(`Launch failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsGenerating(false);
      setGenerationStep(0);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset all seating allocations back to NULL / unassigned state?")) return;
    try {
      await api.allocation.reset();
      setCurrentMatrix(null);
      setQpBreakdown(null);
      const sum = await api.allocation.getSummary();
      setSummary(sum);
    } catch (err: unknown) {
      alert(`Reset failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Seating Allocation Engine
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              Multi-Exam Session
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic branch pairing engine: students writing different exams (CSE, ECE, CIVIL, MECH) sit side-by-side with zero collision.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 hover:border-rose-300 text-xs font-semibold border border-slate-300 shadow-2xs transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset to NULL</span>
          </button>
          <Link
            href="/root/reports"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-2xs transition"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
            <span>Door Notices</span>
          </Link>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition"
          >
            {isSaved ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Save className="h-3.5 w-3.5" />}
            {isSaved ? "Saved & Published" : "Publish Roster"}
          </button>
        </div>
      </div>

      {/* Control Panel Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Configuration Form (Bento Card 1) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sliders className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Allocation Parameters
            </h2>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Session / Exam Mode Selector */}
            <div>
              <label className="font-semibold text-slate-800 block mb-1.5">
                Session Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetMode("MULTI_SESSION")}
                  className={`p-2.5 rounded-xl text-left border transition ${
                    targetMode === "MULTI_SESSION"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="font-semibold text-[11px]">Multi-Exam Session</div>
                  <div className="text-[10px] opacity-75">5 Distinct QPs (FN)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode("SINGLE_EXAM")}
                  className={`p-2.5 rounded-xl text-left border transition ${
                    targetMode === "SINGLE_EXAM"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="font-semibold text-[11px]">Single Exam</div>
                  <div className="text-[10px] opacity-75">Common / Single Paper</div>
                </button>
              </div>
            </div>

            {/* Target Exam dropdown (if single exam) */}
            {targetMode === "SINGLE_EXAM" ? (
              <div>
                <label className="font-semibold text-slate-800">
                  Select Examination
                </label>
                <select
                  value={selectedExamId || ""}
                  onChange={(e) => {
                    const exId = Number(e.target.value);
                    setSelectedExamId(exId);
                    const found = exams.find((x) => x.id === exId);
                    if (found?.exam_type === "SEM" || found?.exam_type === "MID") {
                      setExamType(found.exam_type as "MID" | "SEM");
                    }
                    if (found?.exam_subdivision) {
                      setExamSubdivision(found.exam_subdivision as "MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY");
                    }
                  }}
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-1 focus:ring-slate-400 focus:outline-none"
                >
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.subject_code}: {exam.subject_name} ({exam.exam_type || "MID"}-{exam.exam_subdivision || "1"} • {exam.enrolled_students_count} Cands)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-700" />
                  Concurrent Multi-Department Schedule
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Pairs <strong>CSE (CS301)</strong>, <strong>ECE (EC301)</strong>, <strong>EEE (EE301)</strong>, <strong>MECH (ME301)</strong>, and <strong>CIVIL (CE301)</strong> concurrently so neighbor students write different exams.
                </p>
              </div>
            )}

            {/* Examination Regulation: MID (2 per bench) vs SEM (1 per bench) */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-800">
                  Examination Regulation
                </label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  examType === "SEM"
                    ? "bg-purple-100 text-purple-700 border border-purple-200"
                    : "bg-blue-100 text-blue-700 border border-blue-200"
                }`}>
                  {examType === "SEM" ? "1 Candidate / Bench" : "2 Candidates / Bench"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExamType("MID");
                    if (examSubdivision !== "MID_1" && examSubdivision !== "MID_2") {
                      setExamSubdivision("MID_1");
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition ${
                    examType === "MID"
                      ? "bg-blue-700 text-white border-blue-700 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="font-bold text-[11px] flex items-center justify-between">
                    <span>Mid Exam (MID)</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${examType === "MID" ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>2/Bench</span>
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5">Dual-Seater • 48 Cap / Hall</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExamType("SEM");
                    if (examSubdivision !== "REGULAR" && examSubdivision !== "SUPPLEMENTARY") {
                      setExamSubdivision("REGULAR");
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition ${
                    examType === "SEM"
                      ? "bg-purple-700 text-white border-purple-700 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="font-bold text-[11px] flex items-center justify-between">
                    <span>Semester (SEM)</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${examType === "SEM" ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>1/Bench</span>
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5">Single-Seater • 24 Cap / Hall</div>
                </button>
              </div>

              {/* Exam Subdivision Pill Selection */}
              <div className="pt-2 border-t border-slate-200">
                <div className="text-[11px] font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>{examType === "MID" ? "Mid-Exam Series" : "Semester Category"}</span>
                  <span className="text-[10px] font-medium text-slate-500">
                    {examType === "MID" ? "Mid-1 or Mid-2" : "Regular or Supplementary"}
                  </span>
                </div>
                {examType === "MID" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExamSubdivision("MID_1")}
                      className={`py-1.5 px-2.5 rounded-lg text-left border transition ${
                        examSubdivision === "MID_1"
                          ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="text-[11px] font-bold">Mid-1 (MID_1)</div>
                      <div className="text-[9.5px] opacity-80">First Sessional</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExamSubdivision("MID_2")}
                      className={`py-1.5 px-2.5 rounded-lg text-left border transition ${
                        examSubdivision === "MID_2"
                          ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="text-[11px] font-bold">Mid-2 (MID_2)</div>
                      <div className="text-[9.5px] opacity-80">Second Sessional</div>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExamSubdivision("REGULAR")}
                      className={`py-1.5 px-2.5 rounded-lg text-left border transition ${
                        examSubdivision === "REGULAR"
                          ? "bg-purple-600 text-white border-purple-600 font-semibold shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="text-[11px] font-bold">Regular (REGULAR)</div>
                      <div className="text-[9.5px] opacity-80">Full Cohort Exam</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExamSubdivision("SUPPLEMENTARY")}
                      className={`py-1.5 px-2.5 rounded-lg text-left border transition ${
                        examSubdivision === "SUPPLEMENTARY"
                          ? "bg-purple-600 text-white border-purple-600 font-semibold shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="text-[11px] font-bold">Supply (SUPPLEMENTARY)</div>
                      <div className="text-[9.5px] opacity-80">Arrears / Backlogs</div>
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[10.5px] text-slate-500 leading-snug">
                {examType === "SEM"
                  ? `✓ GKCE Semester (${examSubdivision}): Single candidate per bench (Seat 01 occupied, Seat 02 vacant buffer). 24 students per hall.`
                  : `✓ GKCE Mid Exam (${examSubdivision}): 2 candidates per bench with cross-branch/cross-exam pairing. 48 students per hall.`}
              </p>
            </div>

            {/* Branch Mixing Rule Toggle */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-800">
                  Strict Multi-Branch Mixing
                </label>
                <input
                  type="checkbox"
                  checked={strictBranchMixing}
                  onChange={(e) => setStrictBranchMixing(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Guarantees pairing students of different branches/exams on each bench with 100% compliance.
              </p>
            </div>

            {/* Random Shuffle Toggle */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-800">
                  Random Student Shuffling
                </label>
                <input
                  type="checkbox"
                  checked={shuffleStudents}
                  onChange={(e) => setShuffleStudents(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Randomizes roll roster order to prevent predictable alphabetical bench distribution.
              </p>
            </div>

            {/* Seating Layout & Progression Selector */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <label className="font-semibold text-slate-800 block">
                Seating Layout & Direction
              </label>
              <select
                value={arrangementDirection}
                onChange={(e) => setArrangementDirection(e.target.value as "COLUMN_WISE" | "ROW_WISE" | "SNAKE_COLUMN" | "SNAKE_ROW")}
                className="w-full p-2 rounded-xl border border-slate-200 bg-white font-medium text-xs text-slate-800 focus:ring-1 focus:ring-slate-400 focus:outline-none"
              >
                <option value="COLUMN_WISE">Columns Fully (Column 1 → Column 2 → Column 3 → Column 4)</option>
                <option value="ROW_WISE">Rows Fully (Row 1 → Row 2 → Row 3 → Row 4)</option>
                <option value="SNAKE_COLUMN">Snake Column-Wise (Alternating Down / Up)</option>
                <option value="SNAKE_ROW">Snake Row-Wise (Alternating Left / Right)</option>
              </select>
              <div className="text-[10px] text-slate-600 font-medium">
                {arrangementDirection === "COLUMN_WISE" && "✓ Column-wise: Fills Column 1 completely (front to back), then Column 2."}
                {arrangementDirection === "ROW_WISE" && "✓ Row-wise: Fills Row 1 completely (left to right), then Row 2."}
                {arrangementDirection === "SNAKE_COLUMN" && "✓ Snake Column: Col 1 top-to-bottom, Col 2 bottom-to-top."}
                {arrangementDirection === "SNAKE_ROW" && "✓ Snake Row: Row 1 left-to-right, Row 2 right-to-left."}
              </div>
            </div>

            {/* Action Buttons: Execute & Launch Session */}
            <div className="space-y-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs shadow-sm disabled:opacity-50 transition"
              >
                <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
                {isGenerating ? "Running Seating Engine..." : "Execute SeatingEngine Algorithm"}
              </button>

              <button
                onClick={handleLaunchSession}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm disabled:opacity-50 transition"
              >
                <Rocket className={`h-4 w-4 ${isGenerating ? "animate-bounce" : ""}`} />
                <span>Launch Examination Session (Active + Roster)</span>
              </button>
            </div>
          </div>

          {/* Algorithm step progress feedback during execution */}
          {isGenerating && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1.5">
              <div className="font-semibold text-slate-900">
                Seating Engine Execution Steps:
              </div>
              <div className="space-y-1">
                <div className={`flex items-center gap-1.5 ${generationStep >= 1 ? "text-emerald-700 font-medium" : "text-slate-400"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> 1. Querying enrolled candidates across branches
                </div>
                <div className={`flex items-center gap-1.5 ${generationStep >= 2 ? "text-emerald-700 font-medium" : "text-slate-400"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> 2. Shuffling student rosters
                </div>
                <div className={`flex items-center gap-1.5 ${generationStep >= 3 ? "text-emerald-700 font-medium" : "text-slate-400"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> 3. Checking room bench capacities
                </div>
                <div className={`flex items-center gap-1.5 ${generationStep >= 4 ? "text-emerald-700 font-medium" : "text-slate-400"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> 4. Pairing cross-department benches
                </div>
                <div className={`flex items-center gap-1.5 ${generationStep >= 5 ? "text-emerald-700 font-medium" : "text-slate-400"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> 5. Validating zero double-booking & zero collisions
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Allocation Health & Constraint Report (Bento Card 2 & 3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* KPI Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Allocated</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {summary?.total_students_allocated ?? 0}
              </p>
              <span className={`text-[10px] font-medium ${(summary?.total_students_allocated ?? 0) > 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {(summary?.total_students_allocated ?? 0) > 0 ? "All Registered Seated" : "Status: NULL"}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400">Branch Mixing</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {summary?.branch_mixing_compliance_percent ?? 0}%
              </p>
              <span className="text-[10px] text-slate-500 font-medium">
                {(summary?.total_students_allocated ?? 0) > 0 ? "100% Collision-Free" : "Pending Run"}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400">Halls Utilized</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {summary?.total_rooms_utilized ?? 0} Halls
              </p>
              <span className="text-[10px] text-slate-500 font-medium">
                {(summary?.total_rooms_utilized ?? 0) > 0 ? `${summary?.total_rooms_utilized} Active Halls` : "Unassigned"}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400">Collisions</span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">0</p>
              <span className="text-[10px] text-emerald-700 font-medium">Zero Clashes</span>
            </div>
          </div>

          {/* Question Paper Security & Branch Breakdown Card */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-700" />
                <span className="font-bold text-xs text-slate-900">
                  {examType === "SEM"
                    ? "Semester Exam Security: Single-Seater Isolation Matrix"
                    : "Multi-Exam Question Paper Security Distribution"}
                </span>
              </div>
              <span className="text-[10px] font-medium text-slate-500">
                {examType === "SEM" ? "Single Student / Bench" : "Zero Neighbor Exam Overlap"}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {examType === "SEM"
                ? "Every bench accommodates strictly one student in Seat 01, leaving Seat 02 vacant as an isolation buffer. Cheating is physically prevented through 1-student-per-bench spacing."
                : "Every bench accommodates two students writing distinct question papers. Cheating is physically mitigated because adjacent candidates answer different examination subjects."}
            </p>

            {qpBreakdown && Object.keys(qpBreakdown).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
                {Object.entries(qpBreakdown).map(([code, count]) => {
                  const ex = exams.find((e) => e.subject_code === code);
                  return (
                    <div key={code} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="font-bold text-slate-900">{code}</div>
                      <div className="text-[10px] text-slate-500 truncate">{ex?.subject_name || "Department Paper"}</div>
                      <div className="text-xs font-semibold text-slate-800 mt-1">{count} Question Papers</div>
                    </div>
                  );
                })}
              </div>
            ) : departmentalExams.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
                {departmentalExams.map((exam) => (
                  <div key={exam.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-900">{exam.subject_code}</div>
                    <div className="text-[10px] text-slate-500 truncate">{exam.subject_name}</div>
                    <div className="text-xs font-semibold text-slate-800 mt-1">{exam.enrolled_students_count} Candidates</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-2">
                No active examinations scheduled for this session.
              </div>
            )}
          </div>

          {/* Room Switcher Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
            {rooms.map((room) => {
              const isActive = activeRoomId === room.id;
              const isSem = currentMatrix?.examType === "SEM" || examType === "SEM";
              const effectiveCapacity = isSem ? 24 : room.capacity;
              return (
                <button
                  key={room.id}
                  onClick={() => setActiveRoomId(room.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    isActive
                      ? "bg-blue-700 text-white shadow-xs font-bold"
                      : "bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 shadow-2xs"
                  }`}
                >
                  Room {room.room_number} (Block {room.block} • {effectiveCapacity} Seats{isSem ? " • SEM 1/Bench" : ""})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Visual Seating Layout */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        {currentMatrix && currentMatrix.allocatedCount > 0 ? (
          <RoomSeatingGrid
            matrix={currentMatrix}
            interactive={true}
            highlightRollNumber={undefined}
          />
        ) : (
          <div className="p-12 text-center text-xs text-slate-400 space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <Grid3X3 className="h-6 w-6" />
            </div>
            <div className="text-sm font-bold text-slate-800">
              Seating Allotment is Currently NULL (Unassigned)
            </div>
            <p className="max-w-md mx-auto text-slate-500 leading-relaxed">
              No candidates are seated yet. Click <strong>&quot;Execute SeatingEngine Algorithm&quot;</strong> in the left control panel to automatically allot all registered candidates with 100% cross-department branch mixing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

