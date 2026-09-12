"use client";

import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Printer,
  Download,
  DoorOpen,
  Users,
  UserCheck,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import {
  api,
  ApiDoorNoticeReport,
  ApiInvigilator,
  ApiRoom,
  ApiExam,
} from "@/lib/api";

export default function RootReportsPage() {
  const [activeReport, setActiveReport] = useState<"ROOM" | "INVIGILATOR" | "DESK_SLIPS">("ROOM");
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [doorNotice, setDoorNotice] = useState<ApiDoorNoticeReport | null>(null);
  const [invigilators, setInvigilators] = useState<ApiInvigilator[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial rooms and exams
  useEffect(() => {
    async function loadMeta() {
      try {
        const [rmList, exList, invList] = await Promise.all([
          api.rooms.list(),
          api.exams.list(),
          api.invigilators.list(),
        ]);
        setRooms(rmList);
        setExams(exList);
        setInvigilators(invList);

        if (rmList.length > 0) setSelectedRoomId(rmList[0].id);
        if (exList.length > 0) setSelectedExamId(exList[0].id);
      } catch (err) {
        console.error("Failed to load report parameters:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMeta();
  }, []);

  // Fetch door notice when room or exam changes
  useEffect(() => {
    async function loadNotice() {
      if (!selectedRoomId || !selectedExamId) return;
      try {
        const notice = await api.allocation.getDoorNotice(selectedRoomId, selectedExamId);
        setDoorNotice(notice);
      } catch (err) {
        console.warn("Failed to load door notice:", err);
        setDoorNotice(null);
      }
    }
    loadNotice();
  }, [selectedRoomId, selectedExamId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Reports & Official Printouts
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              Live Database
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Generate and print authentic examination hall door notices, student desk slips, and invigilator duty schedules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Document
          </button>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white/60 backdrop-blur-xl border-white/60 p-4 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
            Select Examination
          </label>
          <select
            value={selectedExamId || ""}
            onChange={(e) => setSelectedExamId(Number(e.target.value))}
            className="p-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.subject_code} - {ex.subject_name} ({ex.exam_type || "MID"}-{ex.exam_subdivision || "1"})
              </option>
            ))}
          </select>
        </div>

        {activeReport !== "INVIGILATOR" && (
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
              Select Room / Hall
            </label>
            <select
              value={selectedRoomId || ""}
              onChange={(e) => setSelectedRoomId(Number(e.target.value))}
              className="p-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {rooms.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  Room {rm.room_number} (Block {rm.block})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Report Selection Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto print:hidden">
        <button
          onClick={() => setActiveReport("ROOM")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeReport === "ROOM"
              ? "bg-blue-700 text-white shadow-xs"
              : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-50"
          }`}
        >
          Room-Wise Seating Chart (Door Notice)
        </button>
        <button
          onClick={() => setActiveReport("INVIGILATOR")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeReport === "INVIGILATOR"
              ? "bg-blue-700 text-white shadow-xs"
              : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-50"
          }`}
        >
          Invigilator Duty Roster
        </button>
        <button
          onClick={() => setActiveReport("DESK_SLIPS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeReport === "DESK_SLIPS"
              ? "bg-blue-700 text-white shadow-xs"
              : "bg-white/60 backdrop-blur-xl border-white/60 text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-50"
          }`}
        >
          Student Desk Slips (Batch)
        </button>
      </div>

      {/* Printable Sheet Canvas */}
      <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 p-8 shadow-xs print:border-none print:shadow-none print:p-0">
        {activeReport === "ROOM" && (
          <div className="space-y-6">
            {/* Academic Header for Door Notice */}
            <div className="text-center border-b-2 border-blue-600 pb-4 space-y-1">
              <h2 className="text-lg font-black tracking-wide uppercase text-slate-900">
                {doorNotice?.institution_name || "Gokula Krishna College of Engineering (Autonomous)"}
              </h2>
              <p className="text-xs font-bold text-slate-600">
                OFFICE OF THE CONTROLLER OF EXAMINATIONS
              </p>
              <h3 className="text-sm font-extrabold text-blue-700 mt-2 uppercase">
                {(() => {
                  const sub = doorNotice?.exam_subdivision || exams.find((e) => e.id === selectedExamId)?.exam_subdivision;
                  const type = doorNotice?.exam_type || exams.find((e) => e.id === selectedExamId)?.exam_type;
                  if (sub === "MID_1") return "Mid-1 Examination Seating Notice (Dual-Seater Policy • 2 Students / Bench)";
                  if (sub === "MID_2") return "Mid-2 Examination Seating Notice (Dual-Seater Policy • 2 Students / Bench)";
                  if (sub === "REGULAR") return "Semester Regular Examination Seating Notice (Single-Seater Policy • 1 Student / Bench)";
                  if (sub === "SUPPLEMENTARY") return "Semester Supplementary Examination Seating Notice (Single-Seater Policy • 1 Student / Bench)";
                  return type === "SEM"
                    ? "Semester Examination Seating Notice (Single-Seater Policy • 1 Student / Bench)"
                    : "Mid Examination Seating Notice (Dual-Seater Policy • 2 Students / Bench)";
                })()}
              </h3>
              <div className="flex justify-center gap-6 text-xs text-slate-600 pt-2 font-mono">
                <span><strong>Subject:</strong> {doorNotice?.subject_code} - {doorNotice?.subject_name}</span>
                <span><strong>Date:</strong> {doorNotice?.exam_date}</span>
                <span><strong>Session:</strong> {doorNotice?.time_slot}</span>
                <span><strong>Hall:</strong> Room {doorNotice?.room_number} (Block {doorNotice?.block})</span>
              </div>
            </div>

            {/* Bench Allocation Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-100 font-bold text-slate-900">
                    <th className="py-2.5 px-3 border border-slate-200">Bench No</th>
                    <th className="py-2.5 px-3 border border-slate-200">Seat</th>
                    <th className="py-2.5 px-3 border border-slate-200">Roll Number</th>
                    <th className="py-2.5 px-3 border border-slate-200">Student Name</th>
                    <th className="py-2.5 px-3 border border-slate-200">Branch</th>
                    <th className="py-2.5 px-3 border border-slate-200 text-center">Invigilator Sign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doorNotice && doorNotice.students.length > 0 ? (
                    doorNotice.students.map((st, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 border border-slate-200 font-bold text-slate-800">
                          Bench {String(st.bench_number).padStart(2, "0")}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 font-mono">
                          Seat {String(st.seat_number).padStart(2, "0")}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 font-mono font-bold text-slate-900">
                          {st.roll_number}
                        </td>
                        <td className="py-2 px-3 border border-slate-200">
                          {st.name}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 font-semibold text-blue-600">
                          {st.department}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 text-center text-slate-300">
                          ___________
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No candidates allocated to this examination room yet. Run the Seating Engine first.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Signature Block */}
            <div className="pt-8 flex justify-between items-end text-xs text-slate-700">
              <div className="text-center">
                <div className="h-10"></div>
                <div className="font-bold border-t border-slate-400 pt-1">Invigilator Signature</div>
              </div>
              <div className="text-center">
                <div className="h-10"></div>
                <div className="font-bold border-t border-slate-400 pt-1">Chief Superintendent</div>
              </div>
              <div className="text-center">
                <div className="h-10"></div>
                <div className="font-bold border-t border-slate-400 pt-1">
                  {doorNotice?.chief_superintendent_signature || "Controller of Examinations"}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeReport === "INVIGILATOR" && (
          <div className="space-y-6">
            <div className="text-center border-b-2 border-blue-600 pb-4 space-y-1">
              <h2 className="text-lg font-black uppercase text-slate-900">
                Gokula Krishna College of Engineering
              </h2>
              <h3 className="text-sm font-extrabold text-blue-700">
                DAILY INVIGILATION DUTY ROSTER
              </h3>
              <p className="text-xs text-slate-500 font-mono">Autonomous End Semester Examinations</p>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 font-bold border-b border-slate-200">
                  <th className="p-3">Faculty Name</th>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Assigned Duty</th>
                  <th className="p-3">Faculty Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invigilators.map((inv) => (
                  <tr key={inv.id}>
                    <td className="p-3 font-bold text-slate-900">{inv.name}</td>
                    <td className="p-3 font-mono">{inv.faculty_id}</td>
                    <td className="p-3">{inv.department_code || "---"}</td>
                    <td className="p-3 font-bold text-blue-600">
                      {inv.assigned_room ? inv.assigned_room : "---"}
                    </td>
                    <td className="p-3 text-slate-300">___________</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === "DESK_SLIPS" && (
          <div className="space-y-6">
            <div className="text-center pb-2">
              <h3 className="text-sm font-bold text-slate-800">
                Student Desk Slip Labels — Printable Grid {doorNotice?.room_number ? `(Room ${doorNotice.room_number})` : ""}
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {doorNotice && doorNotice.students.length > 0 ? (
                doorNotice.students.slice(0, 16).map((st, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 hover:border-blue-300 shadow-2xs space-y-1 text-center"
                  >
                    <div className="text-[10px] font-bold text-slate-400">
                      GKCE EXAM CELL
                    </div>
                    <div className="text-sm font-extrabold text-blue-600">
                      Room {doorNotice.room_number} • Bench {st.bench_number}
                    </div>
                    <div className="font-bold text-slate-800">Authorized Pass</div>
                    <div className="font-mono font-bold text-slate-900 text-xs">
                      {st.roll_number} ({st.department})
                    </div>
                    <div className="text-[11px] font-medium text-slate-700 truncate">
                      {st.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">Seat 0{st.seat_number}</div>
                  </div>
                ))
              ) : (
                <div className="col-span-4 p-8 text-center text-slate-400 text-xs">
                  No desk slips to display.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
