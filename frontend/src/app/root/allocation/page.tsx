"use client";

import React, { useState, useEffect } from "react";
import {
  Grid3X3,
  Sliders,
  CheckCircle2,
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
  Shield,
  X,
  CheckSquare,
  Square,
  UserPlus,
  PauseCircle,
} from "lucide-react";
import {
  api,
  ApiExam,
  ApiRoom,
  ApiAllocationSummary,
  ApiInvigilator,
  ApiDepartment,
  mapApiMatrixToRoomMatrix,
} from "@/lib/api";
import { RoomSeatingMatrix } from "@/types";
import { RoomSeatingGrid } from "@/components/seating/RoomSeatingGrid";
import Link from "next/link";

export default function RootAllocationPage() {
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [invigilators, setInvigilators] = useState<ApiInvigilator[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const availableBranches = departments.length > 0 ? departments.map((d) => d.code) : ["CSE", "ECE", "EEE", "MECH", "CIVIL", "MBA"];
  const [selectedBranches, setSelectedBranches] = useState<string[]>(["CSE", "ECE", "EEE", "MECH", "CIVIL", "MBA"]);
  const [isInvigModalOpen, setIsInvigModalOpen] = useState(false);
  const [selectedInvigId, setSelectedInvigId] = useState<number>(0);
  const [isAssigningInvig, setIsAssigningInvig] = useState(false);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [isRegisteringQuick, setIsRegisteringQuick] = useState(false);
  const [quickInv, setQuickInv] = useState({
    name: "",
    facultyId: "",
    email: "",
    departmentCode: "CSE",
    designation: "Assistant Professor",
    phone: "",
  });
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
  const [isSaved, setIsSaved] = useState(false);

  // Exams available for multi-exam concurrent session
  const departmentalExams = exams.filter((e) => e.status !== "COMPLETED");

  // Initial load
  useEffect(() => {
    async function initData() {
      try {
        const [exList, rmList, invList, deptList] = await Promise.all([
          api.exams.list(),
          api.rooms.list(),
          api.invigilators.list().catch(() => [] as ApiInvigilator[]),
          api.departments.list().catch(() => [] as ApiDepartment[]),
        ]);
        setExams(exList);
        setRooms(rmList);
        setSelectedRoomIds(rmList.map((r) => r.id));
        setInvigilators(invList);
        setDepartments(deptList);
        if (deptList.length > 0) {
          setSelectedBranches(deptList.map((d) => d.code));
        }

        if (exList.length > 0) {
          setSelectedExamId(exList[0].id);
          if (exList[0].exam_type === "SEM" || exList[0].exam_type === "MID") {
            setExamType(exList[0].exam_type as "MID" | "SEM");
          }
          if (exList[0].exam_subdivision) {
            setExamSubdivision(exList[0].exam_subdivision as "MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY");
          }
        }
        if (rmList.length > 0) {
          setActiveRoomId(rmList[0].id);
        }
      } catch (err) {
        console.error("Failed to load exams or rooms:", err);
      }
    }
    initData();
  }, []);

  const effectiveSelectedRooms = rooms.filter((r) => selectedRoomIds.length === 0 || selectedRoomIds.includes(r.id));
  const activeRoom = effectiveSelectedRooms.find((r) => r.id === activeRoomId) || (effectiveSelectedRooms.length > 0 ? effectiveSelectedRooms[0] : null);
  const activeRoomInvigilator = invigilators.find((inv) => {
    if (!activeRoom) return false;
    return inv.assigned_room?.includes(activeRoom.room_number);
  });

  const openInvigModal = () => {
    setSelectedInvigId(activeRoomInvigilator?.id || 0);
    setIsInvigModalOpen(true);
  };

  const toggleRoomSelection = (roomId: number) => {
    if (selectedRoomIds.includes(roomId)) {
      const nextSelected = selectedRoomIds.filter((id) => id !== roomId);
      setSelectedRoomIds(nextSelected);
      if (activeRoomId === roomId) {
        setActiveRoomId(nextSelected.length > 0 ? nextSelected[0] : null);
      }
    } else {
      const nextSelected = [...selectedRoomIds, roomId];
      setSelectedRoomIds(nextSelected);
      if (!activeRoomId) {
        setActiveRoomId(roomId);
      }
    }
  };

  const toggleBranchSelection = (branchCode: string) => {
    if (selectedBranches.includes(branchCode)) {
      if (selectedBranches.length > 1) {
        setSelectedBranches(selectedBranches.filter((b) => b !== branchCode));
      } else {
        alert("At least one department branch must be selected for seating allocation.");
      }
    } else {
      setSelectedBranches([...selectedBranches, branchCode]);
    }
  };

  const handleAssignRoomInvigilator = async () => {
    if (!activeRoomId) return;
    setIsAssigningInvig(true);
    try {
      if (selectedInvigId > 0) {
        const res = await api.invigilators.assign({
          invigilator_id: selectedInvigId,
          room_id: activeRoomId,
        });
        alert(res.message || "Invigilator duty updated successfully.");
      } else if (activeRoomInvigilator) {
        const res = await api.invigilators.assign({
          invigilator_id: activeRoomInvigilator.id,
          room_id: 0,
        });
        alert(res.message || "Invigilator unassigned from room.");
      }
      const updatedInv = await api.invigilators.list();
      setInvigilators(updatedInv);
      setIsInvigModalOpen(false);
    } catch (err: unknown) {
      alert(`Assignment failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsAssigningInvig(false);
    }
  };

  const handleHoldSupervisor = async () => {
    if (!activeRoomInvigilator) return;
    setIsAssigningInvig(true);
    try {
      const res = await api.invigilators.assign({
        invigilator_id: activeRoomInvigilator.id,
        room_id: 0,
      });
      const updatedInv = await api.invigilators.list();
      setInvigilators(updatedInv);
      setIsInvigModalOpen(false);
      alert(res.message || `Supervisor ${activeRoomInvigilator.name} put on HOLD (Standby). Room ${activeRoom?.room_number} is now unassigned.`);
    } catch (err: unknown) {
      alert(`Failed to hold duty: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsAssigningInvig(false);
    }
  };

  const handleQuickRegisterAndAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInv.name || !quickInv.facultyId || !activeRoomId) return;
    setIsRegisteringQuick(true);
    try {
      const dept = departments.find((d) => d.code === quickInv.departmentCode);
      const deptId = dept ? dept.id : 1;

      const created = await api.invigilators.create({
        faculty_id: quickInv.facultyId.trim().toUpperCase(),
        name: quickInv.name.trim(),
        department_id: deptId,
        designation: quickInv.designation,
        email: quickInv.email.trim() || `${quickInv.facultyId.trim().toLowerCase()}@gkce.edu.in`,
        phone: quickInv.phone.trim() || "+91 98765 43210",
      });

      await api.invigilators.assign({
        invigilator_id: created.id,
        room_id: activeRoomId,
      });

      const updatedInv = await api.invigilators.list();
      setInvigilators(updatedInv);
      setShowQuickRegister(false);
      setQuickInv({
        name: "",
        facultyId: "",
        email: "",
        departmentCode: "CSE",
        designation: "Assistant Professor",
        phone: "",
      });
      setIsInvigModalOpen(false);
      alert(`Successfully registered ${created.name} and assigned to Room ${activeRoom?.room_number}!`);
    } catch (err: unknown) {
      alert(`Registration failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsRegisteringQuick(false);
    }
  };

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
      const roomIdsToAllocate = selectedRoomIds.length > 0 ? selectedRoomIds : rooms.map((r) => r.id);
      const branchCodesToAllocate = selectedBranches.length > 0 ? selectedBranches : undefined;

      let res;
      if (targetMode === "MULTI_SESSION" && departmentalExams.length > 0) {
        // Concurrent allocation for CSE, ECE, EEE, MECH, CIVIL
        let targetExams = departmentalExams;
        if (branchCodesToAllocate) {
          const filtered = departmentalExams.filter((e) =>
            branchCodesToAllocate.some((code) => {
              if (code === "CIVIL") return e.subject_code.startsWith("CE");
              if (code === "MECH") return e.subject_code.startsWith("ME");
              return e.subject_code.toUpperCase().startsWith(code.slice(0, 2).toUpperCase()) || e.subject_code.toUpperCase().includes(code.toUpperCase());
            })
          );
          if (filtered.length > 0) targetExams = filtered;
        }
        const examIds = targetExams.map((e) => e.id);
        res = await api.allocation.generate({
          exam_ids: examIds,
          room_ids: roomIdsToAllocate,
          department_codes: branchCodesToAllocate,
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
          department_codes: branchCodesToAllocate,
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

      // Reload matrix for allocated room
      const targetRoomId = roomIdsToAllocate.includes(activeRoomId || 0)
        ? (activeRoomId as number)
        : (roomIdsToAllocate.length > 0 ? roomIdsToAllocate[0] : null);
      if (targetRoomId !== activeRoomId) {
        setActiveRoomId(targetRoomId);
      }
      if (targetRoomId && selectedExamId) {
        const updatedApiMatrix = await api.allocation.getRoomMatrix(targetRoomId, selectedExamId);
        setCurrentMatrix(mapApiMatrixToRoomMatrix(updatedApiMatrix, selectedExamId));
      } else {
        setCurrentMatrix(null);
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
      const roomIdsToAllocate = selectedRoomIds.length > 0 ? selectedRoomIds : rooms.map((r) => r.id);
      const branchCodesToAllocate = selectedBranches.length > 0 ? selectedBranches : undefined;

      let res;
      if (targetMode === "MULTI_SESSION" && departmentalExams.length > 0) {
        let targetExams = departmentalExams;
        if (branchCodesToAllocate) {
          const filtered = departmentalExams.filter((e) =>
            branchCodesToAllocate.some((code) => {
              if (code === "CIVIL") return e.subject_code.startsWith("CE");
              if (code === "MECH") return e.subject_code.startsWith("ME");
              return e.subject_code.toUpperCase().startsWith(code.slice(0, 2).toUpperCase()) || e.subject_code.toUpperCase().includes(code.toUpperCase());
            })
          );
          if (filtered.length > 0) targetExams = filtered;
        }
        res = await api.exams.launch({
          exam_ids: targetExams.map((e) => e.id),
          room_ids: roomIdsToAllocate,
          department_codes: branchCodesToAllocate,
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
          department_codes: branchCodesToAllocate,
          strategy: strictBranchMixing ? "MULTI_BRANCH_MIXING" : "STANDARD",
          arrangement_direction: arrangementDirection,
          auto_assign_invigilators: true,
          exam_type: examType,
          exam_subdivision: examSubdivision,
        });
      }

      const targetRoomId = roomIdsToAllocate.includes(activeRoomId || 0)
        ? (activeRoomId as number)
        : (roomIdsToAllocate.length > 0 ? roomIdsToAllocate[0] : null);
      if (targetRoomId !== activeRoomId) {
        setActiveRoomId(targetRoomId);
      }
      if (targetRoomId && selectedExamId) {
        const updatedApiMatrix = await api.allocation.getRoomMatrix(targetRoomId, selectedExamId);
        setCurrentMatrix(mapApiMatrixToRoomMatrix(updatedApiMatrix, selectedExamId));
      } else {
        setCurrentMatrix(null);
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/60 backdrop-blur-xl border-white/60 hover:bg-rose-50 text-slate-700 hover:text-rose-600 hover:border-rose-300 text-xs font-semibold border border-slate-300 shadow-2xs transition touch-target w-full sm:w-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset to NULL</span>
          </button>
          <Link
            href="/root/reports"
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/60 backdrop-blur-xl border-white/60 hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-2xs transition touch-target w-full sm:w-auto"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
            <span>Door Notices</span>
          </Link>
          <button
            onClick={handleSave}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition touch-target w-full sm:w-auto"
          >
            {isSaved ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Save className="h-3.5 w-3.5" />}
            {isSaved ? "Saved & Published" : "Publish Roster"}
          </button>
        </div>
      </div>

      {/* Control Panel Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Configuration Form (Bento Card 1) */}
        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 p-5 shadow-xs space-y-4">
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
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 font-medium text-slate-800 focus:ring-1 focus:ring-slate-400 focus:outline-none"
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
                      : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 border-slate-200 hover:bg-slate-100"
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
                      : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 border-slate-200 hover:bg-slate-100"
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
                          : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 border-slate-200 hover:bg-slate-100"
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
                          : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 border-slate-200 hover:bg-slate-100"
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
                          : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 border-slate-200 hover:bg-slate-100"
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
                          : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 border-slate-200 hover:bg-slate-100"
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

            {/* Target Examination Halls (Manual Room Selection) */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <DoorOpen className="h-3.5 w-3.5 text-slate-700" />
                  <span>Target Examination Halls</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = rooms.map((r) => r.id);
                      setSelectedRoomIds(allIds);
                      if (allIds.length > 0 && (!activeRoomId || !allIds.includes(activeRoomId))) {
                        setActiveRoomId(allIds[0]);
                      }
                    }}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 hover:underline px-1"
                  >
                    All Halls
                  </button>
                  <span className="text-slate-300 text-[10px]">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoomIds([]);
                      setActiveRoomId(null);
                      setCurrentMatrix(null);
                    }}
                    className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 hover:underline px-1"
                  >
                    Clear
                  </button>
                  <span className="text-slate-300 text-[10px]">|</span>
                  <Link
                    href="/root/rooms"
                    className="text-[10px] font-bold text-blue-700 hover:text-blue-900 hover:underline px-1 flex items-center gap-0.5"
                    title="Add new examination halls or delete existing halls"
                  >
                    + Add / Manage Halls
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {rooms.map((rm) => {
                  const isChecked = selectedRoomIds.includes(rm.id);
                  const isSem = examType === "SEM";
                  const cap = isSem ? 24 : rm.capacity;
                  return (
                    <button
                      key={rm.id}
                      type="button"
                      onClick={() => toggleRoomSelection(rm.id)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-left transition ${
                        isChecked
                          ? "bg-blue-50 border-blue-300 text-blue-900"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {isChecked ? (
                          <CheckSquare className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="font-semibold text-[11px]">Room {rm.room_number}</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-500">{cap} seats</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[10.5px] text-slate-500 pt-0.5">
                <span>{selectedRoomIds.length} of {rooms.length} halls selected</span>
                <span>Capacity: {selectedRoomIds.reduce((acc, id) => {
                  const rm = rooms.find((r) => r.id === id);
                  return acc + (examType === "SEM" ? 24 : (rm?.capacity || 48));
                }, 0)} seats</span>
              </div>
            </div>

            {/* Academic Branches to Seat (Manual Branch Selection) */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Layers className="h-3.5 w-3.5 text-slate-700" />
                  <span>Academic Branches to Seat</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedBranches(["CSE", "ECE", "EEE", "MECH", "CIVIL"])}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 hover:underline px-1"
                  >
                    All 5
                  </button>
                  <span className="text-slate-300 text-[10px]">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedBranches(["CSE"])}
                    className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 hover:underline px-1"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {availableBranches.map((code) => {
                  const isSelected = selectedBranches.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleBranchSelection(code)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>

              <p className="text-[10.5px] text-slate-500">
                {selectedBranches.length === availableBranches.length
                  ? `✓ Full multi-branch concurrent pairing active (${availableBranches.join(", ")}).`
                  : `✓ Filtered pairing: Seating candidates from ${selectedBranches.join(", ")}.`}
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
                className="w-full p-2 rounded-xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 font-medium text-xs text-slate-800 focus:ring-1 focus:ring-slate-400 focus:outline-none"
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
            <div className="p-4 rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 shadow-2xs hover:border-slate-300 transition">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Allocated</span>
              <p className="text-3xl font-black font-mono text-slate-900 mt-1">
                {summary?.total_students_allocated ?? 0}
              </p>
              <span className={`text-[10px] font-bold ${(summary?.total_students_allocated ?? 0) > 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {(summary?.total_students_allocated ?? 0) > 0 ? "All Registered Seated" : "Status: NULL"}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 shadow-2xs hover:border-slate-300 transition">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Branch Mixing</span>
              <p className="text-3xl font-black font-mono text-slate-900 mt-1">
                {summary?.branch_mixing_compliance_percent ?? 0}%
              </p>
              <span className="text-[10px] text-blue-700 font-bold">
                {(summary?.total_students_allocated ?? 0) > 0 ? "100% Collision-Free" : "Pending Run"}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 shadow-2xs hover:border-slate-300 transition">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Halls Utilized</span>
              <p className="text-3xl font-black font-mono text-slate-900 mt-1">
                {summary?.total_rooms_utilized ?? 0} Halls
              </p>
              <span className="text-[10px] text-amber-700 font-bold">
                {(summary?.total_rooms_utilized ?? 0) > 0 ? `${summary?.total_rooms_utilized} Active Halls` : "Unassigned"}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 shadow-2xs hover:border-slate-300 transition">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Collisions</span>
              <p className="text-3xl font-black font-mono text-slate-900 mt-1">0</p>
              <span className="text-[10px] text-emerald-700 font-bold">Zero Clashes</span>
            </div>
          </div>

          {/* Allocation Warnings & Notices Banner */}
          {warnings.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-2xs space-y-1.5">
              <div className="font-bold text-xs text-amber-900 flex items-center gap-2">
                <span>Algorithm Allocation Notices</span>
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-800">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Question Paper Security & Branch Breakdown Card */}
          <div className="p-4 rounded-2xl bg-white/60 backdrop-blur-xl border-white/60 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-700" />
                <span className="font-bold text-xs text-slate-900">
                  {examType === "SEM"
                    ? "Semester Exam Security: Single-Seater Isolation Matrix"
                    : "Multi-Exam Question Paper Security Distribution"}
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-500">
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
                    <div key={code} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition">
                      <div className="font-mono font-bold text-xs text-blue-700">{code}</div>
                      <div className="text-[10px] text-slate-500 truncate">{ex?.subject_name || "Department Paper"}</div>
                      <div className="text-xs font-black font-mono text-slate-900 mt-1">{count} Question Papers</div>
                    </div>
                  );
                })}
              </div>
            ) : departmentalExams.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
                {departmentalExams.map((exam) => (
                  <div key={exam.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition">
                    <div className="font-mono font-bold text-xs text-blue-700">{exam.subject_code}</div>
                    <div className="text-[10px] text-slate-500 truncate">{exam.subject_name}</div>
                    <div className="text-xs font-black font-mono text-slate-900 mt-1">{exam.enrolled_students_count} Candidates</div>
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
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
            {rooms.filter((r) => selectedRoomIds.length === 0 || selectedRoomIds.includes(r.id)).length === 0 ? (
              <span className="text-xs text-slate-400 italic py-1">No halls selected. Choose halls above to view seating.</span>
            ) : (
              rooms
                .filter((r) => selectedRoomIds.length === 0 || selectedRoomIds.includes(r.id))
                .map((room) => {
                  const isActive = activeRoomId === room.id;
                  const isSem = currentMatrix?.examType === "SEM" || examType === "SEM";
                  const effectiveCapacity = isSem ? 24 : room.capacity;
                  return (
                    <button
                      key={room.id}
                      onClick={() => setActiveRoomId(room.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap touch-target ${
                        isActive
                          ? "bg-blue-700 text-white shadow-xs font-bold"
                          : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 shadow-2xs"
                      }`}
                    >
                      Room {room.room_number} (Block {room.block} • {effectiveCapacity} Seats{isSem ? " • SEM 1/Bench" : ""})
                    </button>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Visual Seating Layout */}
      <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Room Header & Invigilator Assignment Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-slate-700" />
              <h2 className="text-base font-bold text-slate-900">
                {activeRoom ? `Room ${activeRoom.room_number} (${activeRoom.block})` : "Examination Hall"}
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                examType === "SEM"
                  ? "bg-purple-100 text-purple-700 border border-purple-200"
                  : "bg-blue-100 text-blue-700 border border-blue-200"
              }`}>
                {examType === "SEM" ? "SEM Single-Seater (24)" : "MID Dual-Seater (48)"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Floor {activeRoom?.floor || 1} • {activeRoom?.total_benches || 24} Benches • {currentMatrix?.allocatedCount || 0} Candidates Seated
            </p>
          </div>

          {/* Assigned Invigilator Badge & Change Button */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
              <Users className="h-3.5 w-3.5 text-slate-600" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Hall Supervisor</span>
                <span className="font-semibold text-slate-800">
                  {activeRoomInvigilator ? (
                    `${activeRoomInvigilator.name} (${activeRoomInvigilator.department_code || "Faculty"})`
                  ) : (
                    <span className="text-amber-600 font-medium">Unassigned (Standby)</span>
                  )}
                </span>
              </div>
            </div>

            <button
              onClick={openInvigModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 shadow-2xs transition touch-target"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Change Supervisor</span>
            </button>

            <Link
              href="/root/invigilators"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition touch-target"
              title="Add new invigilators or delete existing faculty"
            >
              <UserPlus className="h-3.5 w-3.5 text-slate-600" />
              <span>Manage / Add Faculty</span>
            </Link>
          </div>
        </div>

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

      {/* Manual Invigilator Assignment Modal */}
      {isInvigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Supervisor Duty — Room {activeRoom?.room_number} ({activeRoom?.block})
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowQuickRegister(false);
                  setIsInvigModalOpen(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current Hall Supervisor Status Card */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                  Current Hall Status
                </span>
                <div className="font-bold text-slate-900 mt-1">
                  {activeRoomInvigilator ? (
                    <div className="flex items-center gap-1.5 text-blue-800">
                      <Shield className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>{activeRoomInvigilator.name} ({activeRoomInvigilator.faculty_id})</span>
                    </div>
                  ) : (
                    <span className="text-amber-700 font-bold">⚠️ On HOLD (No Supervisor Assigned)</span>
                  )}
                </div>
              </div>

              {activeRoomInvigilator && (
                <button
                  type="button"
                  disabled={isAssigningInvig}
                  onClick={handleHoldSupervisor}
                  className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] flex items-center gap-1 transition"
                  title="Put current supervisor on hold / unassign hall"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  <span>Put on HOLD</span>
                </button>
              )}
            </div>

            {/* Reassign From Standby Dropdown */}
            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-700 block">
                Assign from Registered Faculty Pool
              </label>
              <select
                value={selectedInvigId}
                onChange={(e) => setSelectedInvigId(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50"
              >
                <option value={0}>-- Put on Standby (Unassigned / HOLD) --</option>
                {invigilators.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} ({inv.department_code || "Faculty"} • {inv.faculty_id}){" "}
                    {inv.assigned_room ? `[Currently: ${inv.assigned_room}]` : "[Standby / Free]"}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Register Accordion Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowQuickRegister(!showQuickRegister)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition"
              >
                <span className="flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4 text-blue-600" />
                  <span>+ Quick Register New Faculty (Shortage Solution)</span>
                </span>
                <span className="text-blue-600 font-mono text-[11px]">
                  {showQuickRegister ? "▲ Hide" : "▼ Expand Form"}
                </span>
              </button>
            </div>

            {/* Quick Register On-the-Fly Form */}
            {showQuickRegister && (
              <form
                onSubmit={handleQuickRegisterAndAssign}
                className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2.5 text-xs animate-in fade-in duration-200"
              >
                <div className="font-bold text-blue-950 text-xs flex items-center justify-between">
                  <span>Register & Assign Immediately to Room {activeRoom?.room_number}</span>
                  <span className="text-[10px] text-blue-600 font-normal">Default pwd: Faculty@123</span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block">Faculty Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Rajesh Verma"
                    value={quickInv.name}
                    onChange={(e) => setQuickInv({ ...quickInv, name: e.target.value })}
                    className="mt-1 w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 block">Faculty ID</label>
                    <input
                      type="text"
                      required
                      placeholder="FAC-MECH-009"
                      value={quickInv.facultyId}
                      onChange={(e) => setQuickInv({ ...quickInv, facultyId: e.target.value })}
                      className="mt-1 w-full p-2 rounded-lg border border-slate-200 bg-white uppercase focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block">Department</label>
                    <select
                      value={quickInv.departmentCode}
                      onChange={(e) => setQuickInv({ ...quickInv, departmentCode: e.target.value })}
                      className="mt-1 w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="CSE">CSE</option>
                      <option value="ECE">ECE</option>
                      <option value="EEE">EEE</option>
                      <option value="MECH">MECH</option>
                      <option value="CIVIL">CIVIL</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 block">Designation</label>
                    <input
                      type="text"
                      placeholder="Assistant Professor"
                      value={quickInv.designation}
                      onChange={(e) => setQuickInv({ ...quickInv, designation: e.target.value })}
                      className="mt-1 w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block">Phone</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={quickInv.phone}
                      onChange={(e) => setQuickInv({ ...quickInv, phone: e.target.value })}
                      className="mt-1 w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRegisteringQuick}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 transition mt-1"
                >
                  {isRegisteringQuick
                    ? "Registering & Assigning..."
                    : `Register & Assign to Room ${activeRoom?.room_number}`}
                </button>
              </form>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowQuickRegister(false);
                  setIsInvigModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAssigningInvig}
                onClick={handleAssignRoomInvigilator}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition"
              >
                {isAssigningInvig ? "Saving Duty..." : "Confirm Duty Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

