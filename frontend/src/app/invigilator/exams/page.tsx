"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, Clock, DoorOpen, Users, CheckCircle2, ArrowRight } from "lucide-react";
import { api, ApiDutyAssignment, ApiExam } from "@/lib/api";

export default function InvigilatorExamsPage() {
  const [duties, setDuties] = useState<ApiDutyAssignment[]>([]);
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [dutyList, examList] = await Promise.all([
          api.invigilators.myDuties(),
          api.exams.list(),
        ]);
        setDuties(dutyList);
        setExams(examList);
      } catch (err) {
        console.error("Failed to load duties or exams:", err);
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
            Invigilation Duty Schedule
          </h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
            Live Duty Schedule
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Review your upcoming exam supervision duties and assigned examination halls.
        </p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading duty assignments...</div>
        ) : duties.length > 0 ? (
          duties.map((duty) => (
            <div
              key={duty.id}
              className="rounded-2xl border-2 border-blue-600 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white text-xs font-bold uppercase">
                    Active Duty
                  </span>
                  <span className="text-xs font-mono font-bold text-blue-600">
                    {duty.subject_code}
                  </span>
                </div>

                <h3 className="text-lg font-black text-slate-900">
                  {duty.subject_name}
                </h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{duty.exam_date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>{duty.time_slot}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-blue-600">
                    <DoorOpen className="h-3.5 w-3.5" />
                    <span>Room {duty.room_number} (Block {duty.block})</span>
                  </div>
                </div>
              </div>

              <Link
                href="/invigilator/dashboard"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-200 transition self-start md:self-auto"
              >
                <span>Open Duty Desk</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-xs text-slate-400 border border-slate-200 rounded-2xl">
            No invigilation duties currently assigned to your faculty profile.
          </div>
        )}

        {/* General upcoming examinations */}
        <div className="pt-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3">
            Institutional Exam Timetable
          </h2>
          <div className="space-y-3">
            {exams.map((ex) => (
              <div
                key={ex.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between text-xs shadow-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {ex.subject_code} • {ex.subject_name}
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    {ex.exam_date} • {ex.start_time} - {ex.end_time} • {ex.enrolled_students_count} Students
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                  {ex.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
