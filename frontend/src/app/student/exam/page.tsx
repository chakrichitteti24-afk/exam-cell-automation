"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, Clock, MapPin, CheckCircle2, ArrowRight } from "lucide-react";
import { api, ApiExam, ApiStudentDeskSlip } from "@/lib/api";

export default function StudentExamPage() {
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [deskSlip, setDeskSlip] = useState<ApiStudentDeskSlip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [exList, slip] = await Promise.all([
          api.exams.list(),
          api.allocation.getMyDeskSlip().catch(() => null),
        ]);
        setExams(exList);
        setDeskSlip(slip);
      } catch (err) {
        console.error("Failed to load student exams:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Semester Examination Timetable
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Live Registered Courses
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Registered courses, examination hall assignments, and timings from the GKCE Autonomous Exam Cell.
        </p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 shadow-xs">
            Loading exam timetable...
          </div>
        ) : deskSlip ? (
          /* Allocated active exam */
          <div className="rounded-2xl border-2 border-blue-600 bg-white/60 backdrop-blur-xl border-white/60 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-mono font-bold uppercase shadow-xs">
                {deskSlip.subject_code} • Active Exam
              </span>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Seating Allocated
              </span>
            </div>

            <h3 className="text-base font-extrabold text-slate-900">
              {deskSlip.subject_name}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 text-[10px]">Date</span>
                <p className="font-bold text-slate-800">{deskSlip.exam_date}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 text-[10px]">Timing</span>
                <p className="font-bold text-slate-800">{deskSlip.time_slot}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/80">
                <span className="text-blue-600 text-[10px] font-medium">Hall</span>
                <p className="font-bold text-blue-700">
                  Room {deskSlip.room_number} (Block {deskSlip.block})
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/80">
                <span className="text-blue-600 text-[10px] font-medium">Seat</span>
                <p className="font-bold text-blue-700">
                  Bench {deskSlip.bench_number} • Seat 0{deskSlip.seat_number}
                </p>
              </div>
            </div>

            <Link
              href="/student/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 pt-1"
            >
              <span>Open High-Contrast Desk Slip</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}

        {/* All scheduled exams */}
        <div className="pt-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            All Scheduled Course Examinations
          </h2>
          <div className="space-y-3">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600">
                      {exam.subject_code}
                    </span>
                    <span className="font-bold text-slate-800">
                      {exam.subject_name}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1 flex items-center gap-3">
                    <span>Date: {exam.exam_date}</span>
                    <span>Session: {exam.start_time} - {exam.end_time}</span>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/70 self-start sm:self-auto">
                  {exam.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
