"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Plus,
  Clock,
  Users,
  Grid3X3,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Loader2,
  Rocket,
  ArrowRight,
} from "lucide-react";
import { api, ApiExam } from "@/lib/api";

export default function RootExamsPage() {
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subdivisionFilter, setSubdivisionFilter] = useState<string>("ALL");
  const [launchingExamId, setLaunchingExamId] = useState<number | null>(null);
  const [launchResult, setLaunchResult] = useState<{ examId: number; message: string; ok: boolean } | null>(null);

  const [formData, setFormData] = useState({
    examCode: "",
    title: "",
    date: "2026-09-28",
    startTime: "10:00 AM",
    endTime: "01:00 PM",
    session: "Morning (FN)",
    semester: 5,
    examType: "MID" as "MID" | "SEM",
    examSubdivision: "MID_1" as "MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY",
  });

  const loadExams = async () => {
    setLoading(true);
    try {
      const data = await api.exams.list();
      setExams(data);
    } catch (err) {
      console.error("Failed to load exams:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const handleLaunchAllocation = async (examId: number) => {
    setLaunchingExamId(examId);
    setLaunchResult(null);
    try {
      const res = await api.exams.launch({ exam_id: examId });
      setLaunchResult({ examId, message: `✅ ${res.total_students_allocated} students allocated across ${res.rooms_utilized} rooms.`, ok: true });
      await loadExams();
    } catch (err: unknown) {
      setLaunchResult({ examId, message: `❌ ${err instanceof Error ? err.message : "Allocation failed"}`, ok: false });
    } finally {
      setLaunchingExamId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.examCode) return;

    setIsSubmitting(true);
    setFormError("");

    try {
      await api.exams.create({
        subject_code: formData.examCode.trim().toUpperCase(),
        subject_name: formData.title.trim(),
        exam_date: formData.date,
        start_time: formData.startTime,
        end_time: formData.endTime,
        session: formData.session,
        semester: Number(formData.semester),
        academic_year: "2026-2027",
        status: "SCHEDULED",
        exam_type: formData.examType,
        exam_subdivision: formData.examSubdivision,
      });

      setIsAddModalOpen(false);
      setFormData({
        examCode: "",
        title: "",
        date: "2026-09-28",
        startTime: "10:00 AM",
        endTime: "01:00 PM",
        session: "Morning (FN)",
        semester: 5,
        examType: "MID",
        examSubdivision: "MID_1",
      });
      await loadExams();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to schedule examination.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExams = exams.filter((exam) => {
    if (subdivisionFilter === "ALL") return true;
    if (subdivisionFilter === "MID_1") return exam.exam_subdivision === "MID_1";
    if (subdivisionFilter === "MID_2") return exam.exam_subdivision === "MID_2";
    if (subdivisionFilter === "REGULAR") return exam.exam_subdivision === "REGULAR";
    if (subdivisionFilter === "SUPPLEMENTARY") return exam.exam_subdivision === "SUPPLEMENTARY";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 3-Step Pipeline Banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-xs font-bold text-blue-800 mb-2">ROOT Workflow — Exam Allocation Pipeline</p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 text-white font-semibold">
            <span className="font-mono text-[10px]">01</span>
            <span>Schedule Exam</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-700 font-semibold">
            <Rocket className="h-3.5 w-3.5" />
            <span>Run Allocation Engine</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Live for Students &amp; Invigilators</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Examination Schedules & Courses
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {exams.length} Scheduled
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real autonomous examination timetables, enrolled student lists, and seating engine triggers.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError("");
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition self-start md:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Schedule Examination
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: "ALL", label: "All Examinations" },
          { id: "MID_1", label: "Mid-1 (Dual 2/Bench)" },
          { id: "MID_2", label: "Mid-2 (Dual 2/Bench)" },
          { id: "REGULAR", label: "Sem Regular (Single 1/Bench)" },
          { id: "SUPPLEMENTARY", label: "Sem Supplementary (Single 1/Bench)" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubdivisionFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              subdivisionFilter === tab.id
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Exams List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading examinations...</div>
      ) : filteredExams.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white/60 backdrop-blur-xl border-white/60 rounded-2xl border border-slate-200">
          No examinations found matching the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExams.map((exam) => (
            <div
              key={exam.id}
              className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {exam.subject_code}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      exam.exam_subdivision === "MID_1"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : exam.exam_subdivision === "MID_2"
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : exam.exam_subdivision === "SUPPLEMENTARY"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-purple-50 text-purple-700 border-purple-200"
                    }`}>
                      {exam.exam_subdivision === "MID_1" && "MID-1 (2/Bench)"}
                      {exam.exam_subdivision === "MID_2" && "MID-2 (2/Bench)"}
                      {exam.exam_subdivision === "REGULAR" && "SEM Regular (1/Bench)"}
                      {exam.exam_subdivision === "SUPPLEMENTARY" && "SEM Supply (1/Bench)"}
                      {!exam.exam_subdivision && (exam.exam_type === "SEM" ? "SEM (1/Bench)" : "MID (2/Bench)")}
                    </span>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {exam.status}
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-slate-900 mt-2">
                  {exam.subject_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Semester {exam.semester} • Academic Year {exam.academic_year}
                </p>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold">{exam.exam_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{exam.start_time} - {exam.end_time} ({exam.session})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>
                      <strong>{exam.enrolled_students_count}</strong> Enrolled Candidates (<strong>{exam.allocated_students_count}</strong> Allocated)
                    </span>
                  </div>
                </div>
              </div>

              {/* Launch result toast for this exam */}
              {launchResult && launchResult.examId === exam.id && (
                <div className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${launchResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {launchResult.message}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {exam.status === "ACTIVE" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Live — {exam.allocated_students_count} Allocated
                  </span>
                ) : (
                  <button
                    onClick={() => handleLaunchAllocation(exam.id)}
                    disabled={launchingExamId === exam.id}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded-xl shadow-sm transition disabled:opacity-60"
                  >
                    {launchingExamId === exam.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Rocket className="h-3.5 w-3.5" />
                    )}
                    {launchingExamId === exam.id ? "Allocating..." : "Run Allocation"}
                  </button>
                )}
                <Link
                  href="/root/allocation"
                  className="text-[10px] font-semibold text-slate-400 hover:text-blue-600 transition"
                >
                  View Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Exam Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white/60 backdrop-blur-xl border-white/60 border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Schedule New Examination
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

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS501"
                    value={formData.examCode}
                    onChange={(e) =>
                      setFormData({ ...formData, examCode: e.target.value })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
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
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Subject Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artificial Intelligence & Machine Learning"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Exam Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">
                    Start Time
                  </label>
                  <input
                    type="text"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">
                    End Time
                  </label>
                  <input
                    type="text"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-slate-700">
                  Examination Regulation & Seating Policy
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        examType: "MID",
                        examSubdivision:
                          formData.examSubdivision === "MID_1" || formData.examSubdivision === "MID_2"
                            ? formData.examSubdivision
                            : "MID_1",
                      });
                    }}
                    className={`p-2 rounded-xl text-left border text-xs transition ${
                      formData.examType === "MID"
                        ? "bg-blue-700 text-white border-blue-700 font-bold"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="font-bold text-[11px]">Mid Exam (MID)</div>
                    <div className="text-[10px] opacity-80">2 Students / Bench (Dual)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        examType: "SEM",
                        examSubdivision:
                          formData.examSubdivision === "REGULAR" || formData.examSubdivision === "SUPPLEMENTARY"
                            ? formData.examSubdivision
                            : "REGULAR",
                      });
                    }}
                    className={`p-2 rounded-xl text-left border text-xs transition ${
                      formData.examType === "SEM"
                        ? "bg-purple-700 text-white border-purple-700 font-bold"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="font-bold text-[11px]">Semester Exam (SEM)</div>
                    <div className="text-[10px] opacity-80">1 Student / Bench (Single)</div>
                  </button>
                </div>

                {/* Specific Subdivision Choice */}
                <div className="pt-1.5 border-t border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                    {formData.examType === "MID" ? "Mid Examination Series" : "Semester Scheme Category"}
                  </span>
                  {formData.examType === "MID" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, examSubdivision: "MID_1" })}
                        className={`p-1.5 rounded-lg text-left border text-xs transition ${
                          formData.examSubdivision === "MID_1"
                            ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-xs"
                            : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <div className="font-bold text-[10.5px]">Mid-1 (MID_1)</div>
                        <div className="text-[9px] opacity-80">First Internal Series</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, examSubdivision: "MID_2" })}
                        className={`p-1.5 rounded-lg text-left border text-xs transition ${
                          formData.examSubdivision === "MID_2"
                            ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-xs"
                            : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <div className="font-bold text-[10.5px]">Mid-2 (MID_2)</div>
                        <div className="text-[9px] opacity-80">Second Internal Series</div>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, examSubdivision: "REGULAR" })}
                        className={`p-1.5 rounded-lg text-left border text-xs transition ${
                          formData.examSubdivision === "REGULAR"
                            ? "bg-purple-600 text-white border-purple-600 font-semibold shadow-xs"
                            : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <div className="font-bold text-[10.5px]">Regular (REGULAR)</div>
                        <div className="text-[9px] opacity-80">Main Semester Exam</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, examSubdivision: "SUPPLEMENTARY" })}
                        className={`p-1.5 rounded-lg text-left border text-xs transition ${
                          formData.examSubdivision === "SUPPLEMENTARY"
                            ? "bg-purple-600 text-white border-purple-600 font-semibold shadow-xs"
                            : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <div className="font-bold text-[10.5px]">Supply (SUPPLEMENTARY)</div>
                        <div className="text-[9px] opacity-80">Arrears / Backlogs</div>
                      </button>
                    </div>
                  )}
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
                  {isSubmitting ? "Scheduling..." : "Save Examination"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
