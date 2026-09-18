"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  UploadCloud,
  Download,
  CheckCircle2,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  KeyRound,
} from "lucide-react";
import { api, ApiStudent, ApiDepartment, ImportedCredential } from "@/lib/api";

const DEPT_STYLES: Record<string, { color: string; bgColor: string }> = {
  CSE: { color: "text-blue-700", bgColor: "bg-blue-50" },
  ECE: { color: "text-amber-700", bgColor: "bg-amber-50" },
  EEE: { color: "text-emerald-700", bgColor: "bg-emerald-50" },
  MECH: { color: "text-purple-700", bgColor: "bg-purple-50" },
  CIVIL: { color: "text-rose-700", bgColor: "bg-rose-50" },
};

export default function RootStudentsPage() {
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string>("");
  const [importLoading, setImportLoading] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importCredentials, setImportCredentials] = useState<ImportedCredential[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsPerPage = 12;

  // Form state for Add Student
  const [formData, setFormData] = useState({
    name: "",
    rollNumber: "",
    email: "",
    departmentCode: "CSE",
    semester: 5,
    section: "A",
    academicYear: "2026-2027",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [stList, deptList] = await Promise.all([
        api.students.list({ limit: 500 }),
        api.departments.list().catch(() => []),
      ]);
      setStudents(stList);
      setDepartments(deptList);
    } catch (err) {
      console.error("Failed to fetch students:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [stList, deptList] = await Promise.all([
          api.students.list({ limit: 500 }),
          api.departments.list().catch(() => []),
        ]);
        if (!ignore) {
          setStudents(stList);
          setDepartments(deptList);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch students:", err);
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const filteredStudents = students.filter((s) => {
    const sName = s.name || "";
    const sRoll = s.roll_number || "";
    const sEmail = s.email || "";
    const sDept = s.department_code || "";

    const matchesSearch =
      sName.toLowerCase().includes(search.toLowerCase()) ||
      sRoll.toLowerCase().includes(search.toLowerCase()) ||
      sEmail.toLowerCase().includes(search.toLowerCase());
    const matchesBranch = selectedBranch === "ALL" || sDept === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.rollNumber) return;

    setIsSubmitting(true);
    setFormError("");

    try {
      const targetDept = departments.find((d) => d.code === formData.departmentCode);
      const deptId = targetDept ? targetDept.id : 1;

      await api.students.create({
        name: formData.name.trim(),
        roll_number: formData.rollNumber.trim().toUpperCase(),
        email: formData.email.trim() || `${formData.rollNumber.trim().toLowerCase()}@gkce.edu.in`,
        department_id: deptId,
        semester: Number(formData.semester),
        section: formData.section,
        academic_year: formData.academicYear,
      });

      setIsAddModalOpen(false);
      setFormData({
        name: "",
        rollNumber: "",
        email: "",
        departmentCode: "CSE",
        semester: 5,
        section: "A",
        academicYear: "2026-2027",
      });
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create student record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportStatus("Uploading and parsing student batch file...");
    setImportErrors([]);
    setImportCredentials([]);
    setImportResult(null);

    try {
      const res = await api.students.importCSV(file);
      setImportResult({ imported: res.imported_count, skipped: res.skipped_count, total: res.total_records });
      setImportErrors(res.errors || []);
      setImportCredentials(res.credentials || []);
      setImportStatus(
        res.imported_count > 0
          ? `✅ Successfully imported ${res.imported_count} of ${res.total_records} students.`
          : `⚠️ No new students imported. ${res.skipped_count} records skipped.`
      );
      await loadData();
    } catch (err: unknown) {
      setImportStatus(`❌ Import failed: ${err instanceof Error ? err.message : "Invalid file format"}`);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadCredentials = () => {
    if (!importCredentials.length) return;
    const header = "roll_number,email,temp_password\n";
    const rows = importCredentials.map((c) => `${c.roll_number},${c.email},${c.temp_password}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gkce_student_credentials_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteStudent = async (student: ApiStudent) => {
    if (!confirm(`Delete student "${student.name}" (${student.roll_number})?\n\nThis will permanently remove their record and login account.`)) return;
    setDeletingId(student.id);
    try {
      await api.students.delete(student.id);
      await loadData();
    } catch (err: unknown) {
      alert(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Student Directory
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {students.length} Database Records
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real student database records, batch enrollment import, and credential management.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white/60 backdrop-blur-xl border-white/60 text-xs font-semibold text-slate-800 hover:bg-slate-50 shadow-2xs transition touch-target w-full sm:w-auto"
          >
            <UploadCloud className="h-3.5 w-3.5 text-blue-700" />
            Import CSV
          </button>
          <button
            onClick={() => {
              setFormError("");
              setIsAddModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition touch-target w-full sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Student
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/60 backdrop-blur-xl border-white/60 p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Roll No, Name or Email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Branch:</span>
          {["ALL", "CSE", "ECE", "EEE", "MECH", "CIVIL"].map((branch) => (
            <button
              key={branch}
              onClick={() => {
                setSelectedBranch(branch);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition whitespace-nowrap touch-target ${
                selectedBranch === branch
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60"
              }`}
            >
              {branch}
            </button>
          ))}
        </div>
      </div>

      {/* Students Data Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 font-bold text-slate-700">
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Semester</th>
                <th className="py-3 px-4">Batch</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading GKCE database records...
                  </td>
                </tr>
              ) : paginatedStudents.length > 0 ? (
                paginatedStudents.map((student) => {
                  const dept = student.department_code || "N/A";
                  const style = DEPT_STYLES[dept] || { color: "text-slate-800", bgColor: "bg-slate-100" };
                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50 transition"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {student.roll_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {student.name}
                        </div>
                        <div className="text-[11px] text-slate-400">{student.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${style.bgColor} ${style.color}`}
                        >
                          {dept}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium">Sem {student.semester}</td>
                      <td className="py-3 px-4 text-slate-400">{student.academic_year}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          ACTIVE
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteStudent(student)}
                          disabled={deletingId === student.id}
                          title="Delete student"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition disabled:opacity-40 touch-target"
                        >
                          {deletingId === student.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No matching students found in the database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-bold">{paginatedStudents.length}</span> of{" "}
            <span className="font-bold">{filteredStudents.length}</span> students
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition touch-target"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono font-bold text-slate-700 px-1">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition touch-target"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white/95 backdrop-blur-xl border-white/60 border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Register New Student
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

            <form onSubmit={handleAddStudent} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ch. Tharun Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">
                    Roll Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 23CS099"
                    value={formData.rollNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, rollNumber: e.target.value })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">
                    Branch / Dept
                  </label>
                  <select
                    value={formData.departmentCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">
                    Semester
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={formData.semester}
                    onChange={(e) =>
                      setFormData({ ...formData, semester: Number(e.target.value) })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={formData.academicYear}
                    onChange={(e) =>
                      setFormData({ ...formData, academicYear: e.target.value })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
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
                  {isSubmitting ? "Creating..." : "Add to Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Bulk Import Students</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">ROOT only · Supported: .csv, .xlsx, .xls</p>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStatus("");
                  setImportErrors([]);
                  setImportCredentials([]);
                  setImportResult(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              {/* Column guide */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono">
                <p className="font-bold text-slate-700 mb-1">Required CSV columns:</p>
                <p className="text-slate-500">roll_number, name, department, semester, section, email, academic_year</p>
              </div>

              {/* File input */}
              {!importResult && (
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={importLoading}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-200 rounded-xl p-2 disabled:opacity-60"
                  />
                  {importLoading && (
                    <div className="absolute right-3 top-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    </div>
                  )}
                </div>
              )}

              {/* Loading state */}
              {importLoading && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2 text-blue-700">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Uploading and processing student records...</span>
                </div>
              )}

              {/* Result summary */}
              {importStatus && !importLoading && (
                <div className={`p-3 rounded-xl font-medium border ${
                  importStatus.startsWith("✅") ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                  importStatus.startsWith("⚠️") ? "bg-amber-50 border-amber-200 text-amber-800" :
                  "bg-rose-50 border-rose-200 text-rose-800"
                }`}>
                  {importStatus}
                </div>
              )}

              {/* Result stats bar */}
              {importResult && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <p className="text-lg font-black text-emerald-700">{importResult.imported}</p>
                    <p className="text-[10px] font-semibold text-emerald-600">Imported</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-lg font-black text-amber-700">{importResult.skipped}</p>
                    <p className="text-[10px] font-semibold text-amber-600">Skipped</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-lg font-black text-slate-700">{importResult.total}</p>
                    <p className="text-[10px] font-semibold text-slate-500">Total Rows</p>
                  </div>
                </div>
              )}

              {/* Error list */}
              {importErrors.length > 0 && (
                <div className="space-y-1">
                  <p className="font-semibold text-rose-700 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {importErrors.length} issue{importErrors.length > 1 ? "s" : ""} detected:
                  </p>
                  <div className="max-h-28 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50 p-2 space-y-1">
                    {importErrors.map((err, i) => (
                      <p key={i} className="text-[11px] text-rose-700 font-mono">{err}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Credentials download */}
              {importCredentials.length > 0 && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                  <p className="font-semibold text-blue-800 flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    {importCredentials.length} temporary credentials generated
                  </p>
                  <p className="text-[11px] text-blue-600">Download and distribute to students. Passwords are shown only once.</p>
                  <button
                    onClick={downloadCredentials}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-sm transition w-full justify-center"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Credentials CSV
                  </button>
                </div>
              )}

              {/* Try another file button */}
              {importResult && (
                <button
                  onClick={() => {
                    setImportResult(null);
                    setImportStatus("");
                    setImportErrors([]);
                    setImportCredentials([]);
                  }}
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  ← Import another file
                </button>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStatus("");
                  setImportErrors([]);
                  setImportCredentials([]);
                  setImportResult(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
