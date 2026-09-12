"use client";

import React, { useState, useEffect } from "react";
import {
  UserCheck,
  Plus,
  Search,
  Phone,
  Mail,
  Shield,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle,
  Building,
  ShieldCheck,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { api, ApiInvigilator, ApiRoom, ApiDepartment } from "@/lib/api";

export default function RootInvigilatorsPage() {
  const [invigilators, setInvigilators] = useState<ApiInvigilator[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [newInv, setNewInv] = useState({
    name: "",
    facultyId: "",
    email: "",
    departmentCode: "CSE",
    designation: "Assistant Professor",
    phone: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [invList, rmList, deptList] = await Promise.all([
        api.invigilators.list(),
        api.rooms.list(),
        api.departments.list().catch(() => []),
      ]);
      setInvigilators(invList);
      setRooms(rmList);
      setDepartments(deptList);
    } catch (err) {
      console.error("Failed to load invigilators:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInv.name || !newInv.facultyId) return;

    setIsSubmitting(true);
    setFormError("");

    try {
      const dept = departments.find((d) => d.code === newInv.departmentCode);
      const deptId = dept ? dept.id : 1;

      await api.invigilators.create({
        faculty_id: newInv.facultyId.trim().toUpperCase(),
        name: newInv.name.trim(),
        department_id: deptId,
        designation: newInv.designation,
        email: newInv.email.trim() || `${newInv.facultyId.trim().toLowerCase()}@gkce.edu.in`,
        phone: newInv.phone.trim(),
      });

      setIsAddModalOpen(false);
      setNewInv({
        name: "",
        facultyId: "",
        email: "",
        departmentCode: "CSE",
        designation: "Assistant Professor",
        phone: "",
      });
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to register faculty invigilator.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInvigilator = async (inv: ApiInvigilator) => {
    if (!confirm(`Delete invigilator "${inv.name}" (${inv.faculty_id})?\n\nThis will permanently remove their profile, all duty assignments, and login account.`)) return;
    setDeletingId(inv.id);
    try {
      await api.invigilators.delete(inv.id);
      await loadData();
    } catch (err: unknown) {
      alert(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAutoAssignDuties = async () => {
    setIsAssigning(true);
    try {
      const res = await api.invigilators.assign({ auto_distribute: true });
      await loadData();
      alert(
        `Faculty Duty Roster Successfully Assigned!\n\n` +
        `• Total Halls Assigned: ${res.assignments ? res.assignments.length : "All"}\n` +
        `• Academic Integrity Rule Applied: Non-subject faculty allocated as primary invigilators.\n` +
        `• Subject-dealing faculty reserved as fallback alternatives.`
      );
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
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {invigilators.length} Registered Faculty
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Faculty examination hall assignments and resource-level sandbox controls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleAutoAssignDuties}
            disabled={isAssigning || invigilators.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isAssigning ? "animate-spin" : ""}`} />
            <span>{isAssigning ? "Assigning Duties..." : "Auto-Assign Duties (Exclude Subject Faculty)"}</span>
          </button>

          <button
            onClick={() => {
              setFormError("");
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Invigilator
          </button>
        </div>
      </div>

      {/* Academic Integrity & Conflict-of-Interest Prevention Banner */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-slate-900 block">
              Academic Conflict-of-Interest Prevention Protocol Enforced
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Faculty members who teach or belong to an examination subject are strictly excluded from invigilating that room.
              Non-subject cross-department staff are assigned as primary invigilators. Subject-dealing faculty members serve only as emergency fallback alternatives if cross-department staff is exhausted.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/60 backdrop-blur-xl border-white/60 text-blue-800 border border-blue-200 font-mono shadow-2xs">
            ZERO CONFLICT
          </span>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center justify-between gap-4 bg-white/60 backdrop-blur-xl border-white/60 p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, employee ID, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Invigilators Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading faculty roster...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((inv) => (
            <div
              key={inv.id}
              className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-xs font-mono">
                      {inv.faculty_id.slice(-3)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">
                        {inv.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {inv.faculty_id} • {inv.department_code || "ENG"}
                      </p>
                    </div>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteInvigilator(inv)}
                    disabled={deletingId === inv.id}
                    title="Delete invigilator"
                    className="ml-2 inline-flex items-center justify-center h-7 w-7 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition disabled:opacity-40 shrink-0"
                  >
                    {deletingId === inv.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
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

              {/* Assignment Badge */}
              <div className="pt-3 border-t border-slate-100">
                {inv.assigned_room ? (
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                    <div className="font-bold text-blue-800 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-blue-600" />
                      Assigned: {inv.assigned_room}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Resource-locked strictly to this examination hall.
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-50 text-xs text-slate-400 border border-slate-200/60">
                    Standby • Eligible for assignment
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white/60 backdrop-blur-xl border-white/60 border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Add Faculty Invigilator
              </h3>
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
                <label className="font-semibold text-slate-700">
                  Faculty Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sunita Patel"
                  value={newInv.name}
                  onChange={(e) => setNewInv({ ...newInv, name: e.target.value })}
                  className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">
                    Faculty ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FAC-ECE-005"
                    value={newInv.facultyId}
                    onChange={(e) =>
                      setNewInv({ ...newInv, facultyId: e.target.value })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">
                    Department
                  </label>
                  <select
                    value={newInv.departmentCode}
                    onChange={(e) =>
                      setNewInv({
                        ...newInv,
                        departmentCode: e.target.value,
                      })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="MECH">MECH</option>
                    <option value="CIVIL">CIVIL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Designation
                </label>
                <input
                  type="text"
                  value={newInv.designation}
                  onChange={(e) =>
                    setNewInv({ ...newInv, designation: e.target.value })
                  }
                  className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="e.g. s.patel@gkce.edu.in"
                  value={newInv.email}
                  onChange={(e) => setNewInv({ ...newInv, email: e.target.value })}
                  className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
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
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Adding..." : "Save Invigilator"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
