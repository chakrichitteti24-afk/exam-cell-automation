"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Phone,
  Mail,
  Shield,
  Trash2,
  X,
  AlertCircle,
  AlertTriangle,
  Building,
  ShieldCheck,
  Loader2,
  CheckSquare,
  Square,
  Shuffle,
  PauseCircle,
  UserPlus,
} from "lucide-react";
import { api, ApiInvigilator, ApiRoom, ApiDepartment } from "@/lib/api";

export default function RootInvigilatorsPage() {
  const [invigilators, setInvigilators] = useState<ApiInvigilator[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [selectedInvigIds, setSelectedInvigIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [shortageResult, setShortageResult] = useState<{
    count: number;
    unassignedRooms: string[];
  } | null>(null);

  // Manual Room Assignment Modal State (invigilator -> room)
  const [assignModal, setAssignModal] = useState<{
    isOpen: boolean;
    invigilator: ApiInvigilator | null;
    targetRoomId: number;
  }>({
    isOpen: false,
    invigilator: null,
    targetRoomId: 0,
  });

  // Room Assignment Modal State (room -> invigilator)
  const [roomAssignModal, setRoomAssignModal] = useState<{
    isOpen: boolean;
    room: ApiRoom | null;
    selectedInvigId: number;
  }>({
    isOpen: false,
    room: null,
    selectedInvigId: 0,
  });

  const [isSavingDuty, setIsSavingDuty] = useState(false);

  const [newInv, setNewInv] = useState({
    name: "",
    facultyId: "",
    email: "",
    departmentCode: "CSE",
    designation: "Assistant Professor",
    phone: "",
    autoAssignToRoomId: 0,
  });

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [invList, rmList, deptList] = await Promise.all([
        api.invigilators.list(),
        api.rooms.list(),
        api.departments.list().catch(() => []),
      ]);
      setInvigilators(invList);
      setRooms(rmList);
      setDepartments(deptList);
      setSelectedInvigIds((prev) => {
        if (prev.length === 0) {
          return invList.map((i) => i.id);
        }
        // Keep existing selections that still exist
        const currentIds = new Set(invList.map((i) => i.id));
        return prev.filter((id) => currentIds.has(id));
      });
    } catch (err) {
      console.error("Failed to load invigilators:", err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [invList, rmList, deptList] = await Promise.all([
          api.invigilators.list(),
          api.rooms.list(),
          api.departments.list().catch(() => []),
        ]);
        if (!ignore) {
          setInvigilators(invList);
          setRooms(rmList);
          setDepartments(deptList);
          setSelectedInvigIds(invList.map((i) => i.id));
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load invigilators:", err);
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const toggleSelectFaculty = (id: number) => {
    if (selectedInvigIds.includes(id)) {
      setSelectedInvigIds(selectedInvigIds.filter((item) => item !== id));
    } else {
      setSelectedInvigIds([...selectedInvigIds, id]);
    }
  };

  const handleSelectAll = () => {
    setSelectedInvigIds(invigilators.map((i) => i.id));
  };

  const handleDeselectAll = () => {
    setSelectedInvigIds([]);
  };

  const filtered = invigilators.filter((i) => {
    const name = i.name || "";
    const fid = i.faculty_id || "";
    const dept = i.department_code || "";
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      fid.toLowerCase().includes(search.toLowerCase()) ||
      dept.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Calculate current room coverage
  const roomCoverage = rooms.map((room) => {
    const assignedFaculty = invigilators.find((inv) =>
      inv.assigned_room?.includes(room.room_number)
    );
    return {
      room,
      assignedFaculty,
      isHold: !assignedFaculty,
    };
  });

  const totalRooms = rooms.length;
  const assignedRoomsCount = roomCoverage.filter((rc) => !rc.isHold).length;
  const holdRoomsCount = roomCoverage.filter((rc) => rc.isHold).length;
  const selectedCount = selectedInvigIds.length;
  const potentialShortage = Math.max(0, totalRooms - selectedCount);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInv.name || !newInv.facultyId) return;

    setIsSubmitting(true);
    setFormError("");

    try {
      const dept = departments.find((d) => d.code === newInv.departmentCode);
      const deptId = dept ? dept.id : 1;

      const created = await api.invigilators.create({
        faculty_id: newInv.facultyId.trim().toUpperCase(),
        name: newInv.name.trim(),
        department_id: deptId,
        designation: newInv.designation,
        email: newInv.email.trim() || `${newInv.facultyId.trim().toLowerCase()}@gkce.edu.in`,
        phone: newInv.phone.trim() || "+91 98765 43210",
      });

      // Automatically add new faculty to selected pool
      setSelectedInvigIds((prev) => [...prev, created.id]);

      // If requested to assign immediately to a room
      if (newInv.autoAssignToRoomId > 0) {
        await api.invigilators.assign({
          invigilator_id: created.id,
          room_id: newInv.autoAssignToRoomId,
        });
      }

      setIsAddModalOpen(false);
      setNewInv({
        name: "",
        facultyId: "",
        email: "",
        departmentCode: "CSE",
        designation: "Assistant Professor",
        phone: "",
        autoAssignToRoomId: 0,
      });
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to register faculty invigilator.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInvigilator = async (inv: ApiInvigilator) => {
    if (
      !confirm(
        `Delete invigilator "${inv.name}" (${inv.faculty_id})?\n\nThis will permanently remove their profile, all duty assignments, and login account.`
      )
    )
      return;
    setDeletingId(inv.id);
    try {
      await api.invigilators.delete(inv.id);
      setSelectedInvigIds((prev) => prev.filter((id) => id !== inv.id));
      await loadData();
    } catch (err: unknown) {
      alert(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleHoldDuty = async (inv: ApiInvigilator) => {
    if (!confirm(`Put duty for ${inv.name} on HOLD (Standby)? Room ${inv.assigned_room} will become unassigned.`)) {
      return;
    }
    try {
      const res = await api.invigilators.assign({
        invigilator_id: inv.id,
        room_id: 0,
      });
      await loadData();
      alert(res.message || `${inv.name}'s duty has been placed on HOLD (Standby).`);
    } catch (err: unknown) {
      alert(`Failed to hold duty: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleSaveManualDuty = async () => {
    if (!assignModal.invigilator) return;
    setIsSavingDuty(true);
    try {
      const res = await api.invigilators.assign({
        invigilator_id: assignModal.invigilator.id,
        room_id: assignModal.targetRoomId,
      });
      await loadData();
      setAssignModal({ isOpen: false, invigilator: null, targetRoomId: 0 });
      alert(res.message || "Invigilator duty updated successfully.");
    } catch (err: unknown) {
      alert(`Assignment failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsSavingDuty(false);
    }
  };

  const handleSaveRoomAssign = async () => {
    if (!roomAssignModal.room) return;
    setIsSavingDuty(true);
    try {
      const res = await api.invigilators.assign({
        invigilator_id: roomAssignModal.selectedInvigId,
        room_id: roomAssignModal.selectedInvigId === 0 ? 0 : roomAssignModal.room.id,
      });
      await loadData();
      setRoomAssignModal({ isOpen: false, room: null, selectedInvigId: 0 });
      alert(res.message || "Room supervisor updated successfully.");
    } catch (err: unknown) {
      alert(`Assignment failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsSavingDuty(false);
    }
  };

  const handleAutoAssignDuties = async () => {
    if (selectedInvigIds.length === 0) {
      alert("Please select at least one faculty member to include in duty allocation.");
      return;
    }

    setIsAssigning(true);
    setShortageResult(null);
    try {
      const res = await api.invigilators.assign({
        auto_distribute: true,
        selected_invigilator_ids: selectedInvigIds,
      });
      await loadData();

      if (res.shortage_count && res.shortage_count > 0) {
        setShortageResult({
          count: res.shortage_count,
          unassignedRooms: res.unassigned_rooms || [],
        });
        alert(
          `Duty Allocation Completed with SHORTAGE HOLD!\n\n` +
          `• Assigned Halls: ${res.assignments?.length || 0}\n` +
          `• Halls on HOLD: ${res.shortage_count} (Room(s): ${res.unassigned_rooms?.join(", ")})\n\n` +
          `Root can add new faculty on-the-fly or manually assign standby faculty to fill the shortage.`
        );
      } else {
        alert(
          `Faculty Duty Roster Successfully Assigned!\n\n` +
          `• Total Halls Assigned: ${res.assignments ? res.assignments.length : "All"}\n` +
          `• Randomized selection applied strictly among Root's chosen pool (${selectedInvigIds.length} faculty).\n` +
          `• Academic Integrity Rule Applied: Non-subject faculty allocated as primary invigilators.`
        );
      }
    } catch (err: unknown) {
      alert(`Duty assignment failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Faculty Invigilators & Duty Roster
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {invigilators.length} Registered Faculty
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Root controls: Select faculty pool, trigger randomized allocation with conflict avoidance, manage shortages on hold, and edit assignments anytime.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleAutoAssignDuties}
            disabled={isAssigning || selectedInvigIds.length === 0}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 touch-target w-full sm:w-auto"
          >
            <Shuffle className={`h-3.5 w-3.5 ${isAssigning ? "animate-spin" : ""}`} />
            <span>
              {isAssigning
                ? "Randomly Allocating..."
                : `Randomly Allocate Selected (${selectedInvigIds.length})`}
            </span>
          </button>

          <button
            onClick={() => {
              setFormError("");
              setNewInv((prev) => ({ ...prev, autoAssignToRoomId: 0 }));
              setIsAddModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition touch-target w-full sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Faculty
          </button>
        </div>
      </div>

      {/* Shortage Alert Banner (Dynamic: checks selected vs rooms) */}
      {potentialShortage > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-amber-950 block">
                Invigilator Shortage Warning: {potentialShortage} Examination Hall{potentialShortage > 1 ? "s" : ""} Will Be Placed on HOLD
              </span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                You have selected <strong>{selectedCount} faculty</strong> for <strong>{totalRooms} examination halls</strong>.
                If you proceed, exactly <strong>{potentialShortage} hall(s)</strong> will be placed on <strong>HOLD (Standby)</strong>.
                You can select more registered faculty or quickly register new faculty below.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setFormError("");
                setIsAddModalOpen(true);
              }}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition shadow-xs w-full sm:w-auto touch-target"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ Quick Register Faculty</span>
            </button>
          </div>
        </div>
      )}

      {/* Shortage Result Banner after Auto-Allocation */}
      {shortageResult && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-rose-950 block">
                Allocation Shortage Detected: {shortageResult.count} Hall{shortageResult.count > 1 ? "s" : ""} on Standby HOLD
              </span>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Examination halls <strong>{shortageResult.unassignedRooms.join(", ")}</strong> have no supervisor assigned.
                Click any hall below or use &quot;+ Quick Register Faculty&quot; to cover them immediately.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShortageResult(null)}
            className="text-xs text-rose-700 hover:text-rose-900 font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Room Coverage & Hold Overview Strip */}
      <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-blue-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Examination Hall Supervision & Hold Status
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              Covered: {assignedRoomsCount}
            </span>
            <span className="flex items-center gap-1 text-amber-700 font-semibold">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
              On HOLD: {holdRoomsCount}
            </span>
            <span className="text-slate-400 font-mono">Total: {totalRooms} Halls</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-1">
          {roomCoverage.map(({ room, assignedFaculty, isHold }) => (
            <div
              key={room.id}
              onClick={() => {
                setRoomAssignModal({
                  isOpen: true,
                  room: room,
                  selectedInvigId: assignedFaculty?.id || 0,
                });
              }}
              className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex flex-col justify-between space-y-1.5 ${
                isHold
                  ? "bg-amber-50/80 border-amber-200 hover:border-amber-400 hover:bg-amber-100/70 text-amber-900"
                  : "bg-blue-50/60 border-blue-200 hover:border-blue-400 text-blue-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-slate-900">
                  Room {room.room_number}
                </span>
                <span
                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${
                    isHold
                      ? "bg-amber-200 text-amber-900"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {isHold ? "HOLD" : "ASSIGNED"}
                </span>
              </div>
              <div className="truncate text-[11px]">
                {assignedFaculty ? (
                  <span className="font-semibold text-slate-800 truncate block">
                    {assignedFaculty.name}
                  </span>
                ) : (
                  <span className="text-amber-700 italic font-medium">
                    + Click to Assign
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Block {room.block} • {room.capacity} seats
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Academic Integrity & Selection Protocol Banner */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-slate-900 block">
              Academic Conflict-of-Interest & Randomized Allocation Protocol
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Only faculty selected below are included in the randomized pool. Cross-department staff are assigned as primary invigilators.
              Subject-dealing faculty members serve strictly as fallback alternatives. Root can edit or put any duty on hold after allocation.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/60 backdrop-blur-xl border-white/60 text-blue-800 border border-blue-200 font-mono shadow-2xs">
            ZERO CONFLICT
          </span>
        </div>
      </div>

      {/* Multi-Select Toolbar & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/60 backdrop-blur-xl p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition touch-target"
          >
            <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
            <span>Select All ({invigilators.length})</span>
          </button>
          <button
            type="button"
            onClick={handleDeselectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition touch-target"
          >
            <Square className="h-3.5 w-3.5 text-slate-400" />
            <span>Deselect All</span>
          </button>
          <span className="text-xs text-slate-500 font-medium pl-2 hidden md:inline">
            Selected for Allocation: <strong className="text-blue-700">{selectedInvigIds.length}</strong> / {invigilators.length}
          </span>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, employee ID, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>
      </div>

      {/* Invigilators Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading faculty roster...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((inv) => {
            const isSelected = selectedInvigIds.includes(inv.id);
            return (
              <div
                key={inv.id}
                className={`rounded-2xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition ${
                  isSelected
                    ? "border-blue-300 bg-white/90 shadow-blue-50"
                    : "border-slate-200 bg-slate-50/60 opacity-80"
                }`}
              >
                <div>
                  {/* Top row: Checkbox for selection + Profile info + Delete */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSelectFaculty(inv.id)}
                        className="mt-1 shrink-0 p-1 rounded-lg text-slate-400 hover:text-blue-600 focus:outline-none transition"
                        title={isSelected ? "Remove from allocation pool" : "Include in allocation pool"}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Square className="h-5 w-5 text-slate-300" />
                        )}
                      </button>

                      <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                        {inv.faculty_id.slice(-3)}
                      </div>

                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                          {inv.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {inv.faculty_id} • {inv.department_code || "ENG"}
                        </p>
                        <div className="mt-1">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                              isSelected
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {isSelected ? "In Allocation Pool" : "Excluded"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteInvigilator(inv)}
                      disabled={deletingId === inv.id}
                      title="Delete invigilator"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition disabled:opacity-40 shrink-0"
                    >
                      {deletingId === inv.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Contact details */}
                  <div className="mt-4 space-y-1.5 text-xs text-slate-600 pl-8">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{inv.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{inv.phone || "---"}</span>
                    </div>
                  </div>
                </div>

                {/* Assignment Badge & Action Buttons */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {inv.assigned_room ? (
                        <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                          <div className="font-bold text-blue-800 flex items-center gap-1.5 truncate">
                            <Shield className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">Assigned: {inv.assigned_room}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Sandboxed supervisor
                          </p>
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-slate-50 text-xs text-slate-500 border border-slate-200/60 font-medium">
                          Standby • No duty assigned
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Post-Allocation Edit / Hold Actions */}
                  <div className="flex items-center gap-1.5 justify-end">
                    {inv.assigned_room && (
                      <button
                        type="button"
                        onClick={() => handleHoldDuty(inv)}
                        title="Put this faculty on standby hold"
                        className="px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold flex items-center gap-1 transition touch-target"
                      >
                        <PauseCircle className="h-3 w-3" />
                        <span>Hold Duty</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const match = inv.assigned_room
                          ? rooms.find((r) => inv.assigned_room?.includes(r.room_number))
                          : null;
                        setAssignModal({
                          isOpen: true,
                          invigilator: inv,
                          targetRoomId: match ? match.id : 0,
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 text-slate-700 font-semibold text-[11px] transition touch-target"
                    >
                      {inv.assigned_room ? "Edit Room" : "Assign Room"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Invigilator Modal (Supports Quick Room Assignment) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Quick Register Faculty Member
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Instant registration with default credentials (<code className="font-mono">Faculty@123</code>).
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAdd} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Faculty Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sunita Patel"
                  value={newInv.name}
                  onChange={(e) => setNewInv({ ...newInv, name: e.target.value })}
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Faculty ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FAC-ECE-005"
                    value={newInv.facultyId}
                    onChange={(e) =>
                      setNewInv({ ...newInv, facultyId: e.target.value })
                    }
                    className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Department</label>
                  <select
                    value={newInv.departmentCode}
                    onChange={(e) =>
                      setNewInv({
                        ...newInv,
                        departmentCode: e.target.value,
                      })
                    }
                    className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="MECH">MECH</option>
                    <option value="CIVIL">CIVIL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Designation</label>
                  <input
                    type="text"
                    value={newInv.designation}
                    onChange={(e) =>
                      setNewInv({ ...newInv, designation: e.target.value })
                    }
                    className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={newInv.phone}
                    onChange={(e) => setNewInv({ ...newInv, phone: e.target.value })}
                    className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. s.patel@gkce.edu.in"
                  value={newInv.email}
                  onChange={(e) => setNewInv({ ...newInv, email: e.target.value })}
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Instant Room Assignment Option */}
              <div>
                <label className="font-semibold text-slate-700">
                  Assign Immediately to Hall (Optional)
                </label>
                <select
                  value={newInv.autoAssignToRoomId}
                  onChange={(e) =>
                    setNewInv({ ...newInv, autoAssignToRoomId: Number(e.target.value) })
                  }
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value={0}>-- Keep on Standby (Unassigned) --</option>
                  {rooms.map((r) => {
                    const occ = invigilators.find((i) => i.assigned_room?.includes(r.room_number));
                    return (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} ({r.block}) {occ ? `[Occupied: ${occ.name}]` : "[HOLD - Free]"}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Registering..." : "Save & Add to Pool"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Room Assignment Modal (From Faculty Card) */}
      {assignModal.isOpen && assignModal.invigilator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Examination Hall Assignment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign or change hall for {assignModal.invigilator.name} ({assignModal.invigilator.faculty_id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModal({ isOpen: false, invigilator: null, targetRoomId: 0 })}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Select Examination Hall / Status
                </label>
                <select
                  value={assignModal.targetRoomId}
                  onChange={(e) =>
                    setAssignModal((prev) => ({
                      ...prev,
                      targetRoomId: Number(e.target.value),
                    }))
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value={0}>Standby (Unassigned / Put Duty on Hold)</option>
                  {rooms.map((r) => {
                    const occ = invigilators.find(
                      (i) =>
                        i.id !== assignModal.invigilator?.id &&
                        i.assigned_room?.includes(r.room_number)
                    );
                    return (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} (Block {r.block} • {r.capacity} Seats){" "}
                        {occ ? `[Occupied by ${occ.name}]` : "[HOLD / Free]"}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-[11px] space-y-1">
                <span className="font-bold block">Academic Integrity Notice:</span>
                <p>
                  Faculty member belongs to <strong>Department of {assignModal.invigilator.department_code || "Engineering"}</strong>.
                  Selecting an assigned room will safely reassign that hall to this faculty member.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setAssignModal({ isOpen: false, invigilator: null, targetRoomId: 0 })
                  }
                  className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveManualDuty}
                  disabled={isSavingDuty}
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs disabled:opacity-50 transition"
                >
                  {isSavingDuty ? "Saving Duty..." : "Confirm & Save Assignment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Assignment Modal (From Room Coverage Bar) */}
      {roomAssignModal.isOpen && roomAssignModal.room && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Supervise Room {roomAssignModal.room.room_number} (Block {roomAssignModal.room.block})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a faculty member from the standby roster to assign or put this room on hold.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRoomAssignModal({ isOpen: false, room: null, selectedInvigId: 0 })
                }
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Select Faculty Member
                </label>
                <select
                  value={roomAssignModal.selectedInvigId}
                  onChange={(e) =>
                    setRoomAssignModal((prev) => ({
                      ...prev,
                      selectedInvigId: Number(e.target.value),
                    }))
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value={0}>-- Put Room on HOLD (Unassigned) --</option>
                  {invigilators.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} ({inv.department_code || "Faculty"} • {inv.faculty_id}){" "}
                      {inv.assigned_room
                        ? `[Currently in ${inv.assigned_room}]`
                        : "[Standby / Available]"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between">
                <span>Need a faculty not in the roster?</span>
                <button
                  type="button"
                  onClick={() => {
                    const rId = roomAssignModal.room?.id || 0;
                    setRoomAssignModal({ isOpen: false, room: null, selectedInvigId: 0 });
                    setNewInv((prev) => ({ ...prev, autoAssignToRoomId: rId }));
                    setIsAddModalOpen(true);
                  }}
                  className="font-bold underline text-amber-800 hover:text-amber-950"
                >
                  + Quick Register & Assign
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setRoomAssignModal({ isOpen: false, room: null, selectedInvigId: 0 })
                  }
                  className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoomAssign}
                  disabled={isSavingDuty}
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs disabled:opacity-50 transition"
                >
                  {isSavingDuty ? "Updating..." : "Save Supervisor"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
