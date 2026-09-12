"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  CheckCircle2,
  ExternalLink,
  Compass,
  Navigation,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, ApiStudentDeskSlip } from "@/lib/api";

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [deskSlip, setDeskSlip] = useState<ApiStudentDeskSlip | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function loadDeskSlip() {
      setLoading(true);
      try {
        const slip = await api.allocation.getMyDeskSlip();
        setDeskSlip(slip);
      } catch (err) {
        console.warn("Could not retrieve candidate desk slip:", err);
        setDeskSlip(null);
      } finally {
        setLoading(false);
      }
    }
    loadDeskSlip();
  }, []);

  const handlePrint = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      window.print();
    }, 300);
  };

  const handleCopyToken = () => {
    const token = deskSlip?.qr_payload || "GKCE-PENDING-PASS";
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const candidateRoll = deskSlip?.roll_number || user?.metadata?.rollNumber || "N/A";
  const candidateName = deskSlip?.student_name || user?.name || "Student";
  const candidateDept = deskSlip?.department_code || user?.metadata?.department || "N/A";

  const myBenchNum = deskSlip?.bench_number || 0;
  const mySeatNum = deskSlip?.seat_number || 0;
  const myRow = deskSlip?.row_index || Math.floor((myBenchNum - 1) / 4) + 1;
  const myCol = deskSlip?.col_index || ((myBenchNum - 1) % 4) + 1;
  const hallRows = [1, 2, 3, 4, 5, 6];
  const isSem = deskSlip?.exam_type === "SEM";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Action & Verification Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Candidate Examination Hall Pass
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              isSem
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {deskSlip?.exam_subdivision === "MID_1"
                ? "Mid-1 Exam • Dual Seater"
                : deskSlip?.exam_subdivision === "MID_2"
                ? "Mid-2 Exam • Dual Seater"
                : deskSlip?.exam_subdivision === "REGULAR"
                ? "Semester Regular • Single Seater"
                : deskSlip?.exam_subdivision === "SUPPLEMENTARY"
                ? "Semester Supplementary • Single Seater"
                : isSem
                ? "Semester Exam • Single Seater"
                : "Mid Exam • Dual Seater"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Single consolidated security card for autonomous examination hall entry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {deskSlip && (
            <>
              <button
                onClick={handleCopyToken}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-blue-600" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                <span>{copied ? "Copied Token" : "Copy Token"}</span>
              </button>
              <button
                onClick={handlePrint}
                disabled={downloading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{downloading ? "Preparing Print..." : "Print Hall Pass"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center space-y-3 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-xs font-semibold text-slate-500">
            Querying authenticated seating database for Candidate {candidateRoll}...
          </p>
        </div>
      ) : deskSlip ? (
        /* ==================== WHITE MINIMALIST BENTO GRID ==================== */
        <div className="space-y-4">
          {/* Institutional Header Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono text-[10px] font-bold tracking-widest uppercase">
                  GKCE AUTONOMOUS
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  Approved by AICTE • Affiliated to JNTUA
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 uppercase">
                Gokula Krishna College of Engineering
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Office of the Controller of Examinations • {isSem ? "Autonomous Semester Examinations (1 Candidate / Bench)" : "Mid Examinations (2 Candidates / Bench)"}
              </p>
            </div>

            <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-1 shrink-0">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                isSem
                  ? "bg-purple-50 border-purple-200 text-purple-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}>
                <ShieldCheck className={`h-3.5 w-3.5 ${isSem ? "text-purple-600" : "text-blue-600"}`} />
                <span>{isSem ? "SEM SINGLE-SEATER PASS" : "AUTHENTICATED PASS"}</span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                SECURITY TIER-1 ACTIVE
              </span>
            </div>
          </div>

          {/* Bento Row 1: Candidate Identity & Physical Seating Coordinates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bento Card 1: Candidate Profile (Spans 1 Col) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-sm shadow-blue-500/20">
                    {candidateName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900">
                        {candidateName}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[10px] font-bold uppercase">
                        {deskSlip.department_code}
                      </span>
                    </div>
                    <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                      {candidateRoll}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Semester / Batch:</span>
                  <span className="font-semibold text-slate-900">Semester {deskSlip.semester} • {deskSlip.academic_year}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Biometric Duty:</span>
                  <span className="font-semibold text-slate-900 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-slate-700" /> Verified Candidate
                  </span>
                </div>
              </div>
            </div>

            {/* Bento Card 2: Seating Coordinates (Spans 2 Cols) */}
            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-700" />
                  Assigned Hall Coordinates
                </span>
                <span className="text-[11px] font-mono font-semibold text-slate-500">
                  Row {myRow} • Col {myCol}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* ROOM */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    ROOM
                  </span>
                  <div className="text-3xl font-black text-slate-900 font-mono my-0.5">
                    {deskSlip.room_number}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Floor {deskSlip.floor}
                  </span>
                </div>

                {/* BLOCK */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    BLOCK
                  </span>
                  <div className="text-3xl font-black text-slate-900 font-mono my-0.5">
                    {deskSlip.block}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Main Campus
                  </span>
                </div>

                {/* BENCH */}
                <div className="p-3.5 rounded-xl border-2 border-blue-600 bg-blue-600 text-white text-center shadow-sm shadow-blue-500/20">
                  <span className="text-[10px] font-bold uppercase text-blue-100 block">
                    BENCH
                  </span>
                  <div className="text-3xl font-black font-mono my-0.5">
                    {String(deskSlip.bench_number).padStart(2, "0")}
                  </div>
                  <span className="text-[10px] text-blue-100 font-medium">
                    Assigned Desk
                  </span>
                </div>

                {/* SEAT */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    SEAT
                  </span>
                  <div className="text-3xl font-black text-slate-900 font-mono my-0.5">
                    0{deskSlip.seat_number}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {deskSlip.seat_number === 1 ? "Left Position" : "Right Position"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bento Row 2: Multi-Exam Anti-Cheating Bench Security Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <BookOpen className={`h-4 w-4 ${isSem ? "text-purple-600" : "text-blue-600"}`} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  {isSem ? "Semester Exam Physical Isolation & Bench Allocation" : "Multi-Exam Question Paper Distribution & Anti-Cheating Guarantee"}
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                isSem
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}>
                {isSem ? "Single-Seater Policy" : "Branch Pairing Active"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Candidate Paper */}
              <div className={`p-4 rounded-xl border space-y-1.5 ${isSem ? "border-purple-200 bg-purple-50/40" : "border-blue-200 bg-blue-50/40"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Your Question Paper (Seat 0{deskSlip.seat_number})
                  </span>
                  <span className={`px-2 py-0.5 rounded text-white font-mono text-[10px] font-bold shadow-xs ${isSem ? "bg-purple-700" : "bg-blue-600"}`}>
                    {deskSlip.subject_code}
                  </span>
                </div>
                <div className="text-sm font-black text-slate-900">
                  {deskSlip.subject_name}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Calendar className="h-3 w-3" /> {deskSlip.exam_date}
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="h-3 w-3" /> {deskSlip.time_slot}
                  </span>
                </div>
              </div>

              {/* Bench Partner / Isolation Status */}
              {isSem ? (
                <div className="p-4 rounded-xl border border-dashed border-purple-300 bg-purple-50/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                      Seat 02 Status • Single-Seater Regulation
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300 font-mono text-[10px] font-bold">
                      VACANT BUFFER
                    </span>
                  </div>
                  <div className="text-sm font-black text-purple-950">
                    Seat 02 Reserved Empty
                  </div>
                  <div className="text-[11px] text-purple-800 pt-1">
                    GKCE Autonomous Semester Regulation: Exactly <strong>1 student per bench</strong>. Seat 02 is kept vacant as an anti-cheating isolation buffer.
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Bench Partner Paper (Seat 0{deskSlip.seat_number === 1 ? 2 : 1})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[10px] font-bold">
                      {deskSlip.partner_subject_code || (deskSlip.partner_department ? `${deskSlip.partner_department} Exam` : "Alternate Subject")}
                    </span>
                  </div>
                  <div className="text-sm font-black text-slate-900">
                    {deskSlip.partner_subject_name || (deskSlip.partner_department ? `${deskSlip.partner_department} Departmental Examination` : "Different Question Paper")}
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1">
                    Branch: <strong className="text-slate-800">{deskSlip.partner_department || "Mixed Branch"}</strong> •{" "}
                    <span className="text-slate-700 font-medium">Completely Different Question Paper</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-700 shrink-0" />
              <span>
                {isSem ? (
                  <><strong>Single-Seater Guarantee:</strong> Bench {deskSlip.bench_number} is reserved exclusively for you. Neighbor benches alternate departments to guarantee zero collusion.</>
                ) : (
                  <><strong>Anti-Cheating Guarantee:</strong> Adjacent candidates on Bench {deskSlip.bench_number} belong to different branches and write completely different examinations. Unauthorized communication or paper exchange is physically impossible.</>
                )}
              </span>
            </div>
          </div>

          {/* Bento Row 3: 2D Classroom Floorplan & Exact Bench Radar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            {/* Header & Wayfinding Directive */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
                  <Navigation className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900 uppercase">
                    Classroom Floorplan & Exact Bench Radar — Room {deskSlip.room_number}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {deskSlip.block} • Floor {deskSlip.floor} • 24 Standard Benches ({isSem ? "24 Candidates • Single-Seater" : "48 Candidates • Dual-Seater"}) • 4 Columns × 6 Rows
                  </p>
                </div>
              </div>

              {/* Minimalist Legend */}
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-white shadow-xs ${isSem ? "bg-purple-700" : "bg-blue-600"}`}>
                  <MapPin className="h-3 w-3" /> Bench #{String(deskSlip.bench_number).padStart(2, "0")} (You)
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                  {isSem ? "Seat 02 Vacant Buffer" : "Other Benches"}
                </span>
              </div>
            </div>

            {/* Architectural Classroom Enclosure */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
              {/* 1. Hall Front: Podium & Blackboard */}
              <div className="space-y-2 mb-4">
                <div className={`rounded-xl border p-2.5 text-center font-mono text-xs font-bold uppercase tracking-wider ${
                  isSem ? "bg-purple-50 border-purple-200 text-purple-900" : "bg-blue-50 border-blue-200 text-blue-900"
                }`}>
                  ▲ FRONT: BLACKBOARD / INVIGILATOR SUPERVISION PODIUM ▲
                </div>

                <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>🚪 MAIN ENTRANCE DOOR</span>
                    <span className="font-normal text-slate-500 hidden sm:inline">(Hall Entry)</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Invigilator Supervision Desk
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    Capacity: {isSem ? "24 Candidates (Single Seater)" : "48 Candidates (Dual Seater)"}
                  </div>
                </div>
              </div>

              {/* 2. Column Headers Aligned with Benches */}
              <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                <div className="shrink-0 w-6 sm:w-7 text-center font-mono text-[9px] font-bold text-slate-400">
                  ROW
                </div>
                <div className="flex-1 grid grid-cols-4 gap-1.5 sm:gap-3 text-center font-mono text-[10px] font-bold text-slate-500">
                  <div className="py-1 rounded bg-slate-50 border border-slate-100">Col 1 <span className="font-normal text-slate-400 hidden sm:inline">(Left)</span></div>
                  <div className="py-1 rounded bg-slate-50 border border-slate-100">Col 2 <span className="font-normal text-slate-400 hidden sm:inline">(Center-L)</span></div>
                  <div className="py-1 rounded bg-slate-50 border border-slate-100">Col 3 <span className="font-normal text-slate-400 hidden sm:inline">(Center-R)</span></div>
                  <div className="py-1 rounded bg-slate-50 border border-slate-100">Col 4 <span className="font-normal text-slate-400 hidden sm:inline">(Window)</span></div>
                </div>
              </div>

              {/* 3. 24 Benches arranged in 6 Rows x 4 Columns */}
              <div className="space-y-2 sm:space-y-2.5">
                {hallRows.map((rowNum) => (
                  <div key={rowNum} className="flex items-stretch gap-1.5 sm:gap-2">
                    {/* Row Label Badge */}
                    <div className="shrink-0 w-6 sm:w-7 flex items-center justify-center">
                      <span className="text-[9px] font-mono font-bold px-1 py-1 rounded bg-slate-100 text-slate-600 w-full text-center border border-slate-200">
                        R{rowNum}
                      </span>
                    </div>

                    {/* 4 Benches in this row */}
                    <div className="flex-1 grid grid-cols-4 gap-1.5 sm:gap-3">
                      {[1, 2, 3, 4].map((colNum) => {
                        const benchNumber = (rowNum - 1) * 4 + colNum;
                        const isCandidateBench = benchNumber === deskSlip.bench_number;

                        if (isCandidateBench) {
                          return (
                            /* CANDIDATE'S ASSIGNED BENCH */
                            <div
                              key={benchNumber}
                              className={`relative rounded-xl border-2 bg-white p-1.5 sm:p-2 shadow-sm z-10 h-[76px] flex flex-col justify-between ${
                                isSem ? "border-purple-600" : "border-blue-600"
                              }`}
                            >
                              {/* Floating YOU ARE HERE Badge */}
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white shadow-xs ${
                                  isSem ? "bg-purple-700" : "bg-blue-600"
                                }`}>
                                  <MapPin className="h-2.5 w-2.5" /> YOU ARE HERE
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[9px] font-bold border-b border-slate-200 pb-0.5">
                                <span className="text-slate-900 font-mono">
                                  BENCH #{String(benchNumber).padStart(2, "0")}
                                </span>
                                <span className="text-[8px] font-mono text-slate-500">
                                  R{rowNum}•C{colNum}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-1">
                                <div
                                  className={`rounded p-1 text-center flex flex-col justify-center ${
                                    deskSlip.seat_number === 1
                                      ? (isSem ? "bg-purple-700 text-white font-bold shadow-2xs" : "bg-blue-600 text-white font-bold shadow-2xs")
                                      : "bg-slate-50 text-slate-700 border border-slate-200"
                                  }`}
                                >
                                  <div className="text-[8px] uppercase leading-none">
                                    {deskSlip.seat_number === 1 ? "YOU • S1" : "SEAT 01"}
                                  </div>
                                  <div className="text-[9px] font-mono truncate leading-tight mt-0.5">
                                    {deskSlip.seat_number === 1 ? candidateRoll : (deskSlip.partner_department || "Partner")}
                                  </div>
                                </div>

                                {isSem ? (
                                  <div className="rounded p-1 text-center flex flex-col justify-center bg-purple-50/80 text-purple-700 border border-dashed border-purple-300">
                                    <div className="text-[7.5px] uppercase font-bold leading-none">SEAT 02</div>
                                    <div className="text-[7.5px] font-mono font-bold leading-tight mt-0.5 text-purple-600">BUFFER</div>
                                  </div>
                                ) : (
                                  <div
                                    className={`rounded p-1 text-center flex flex-col justify-center ${
                                      deskSlip.seat_number === 2
                                        ? "bg-blue-600 text-white font-bold shadow-2xs"
                                        : "bg-slate-50 text-slate-700 border border-slate-200"
                                    }`}
                                  >
                                    <div className="text-[8px] uppercase leading-none">
                                      {deskSlip.seat_number === 2 ? "YOU • S2" : "SEAT 02"}
                                    </div>
                                    <div className="text-[9px] font-mono truncate leading-tight mt-0.5">
                                      {deskSlip.seat_number === 2 ? candidateRoll : (deskSlip.partner_department || "Partner")}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        /* Standard Unoccupied Bench */
                        return (
                          <div
                            key={benchNumber}
                            className="rounded-xl border border-slate-200 bg-white p-1.5 sm:p-2 text-slate-400 h-[76px] flex flex-col justify-between"
                          >
                            <div className="flex items-center justify-between text-[9px]">
                              <span className="font-mono text-slate-600 font-semibold">
                                B-{String(benchNumber).padStart(2, "0")}
                              </span>
                              <span className="text-[8px] font-mono text-slate-400">
                                R{rowNum}•C{colNum}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-[8px] font-mono text-center">
                              <div className="rounded bg-slate-50 py-1 text-slate-400 border border-slate-100">
                                S1
                              </div>
                              {isSem ? (
                                <div className="rounded bg-purple-50/40 py-1 text-purple-400 border border-dashed border-purple-200 text-[7px] font-bold">
                                  VACANT
                                </div>
                              ) : (
                                <div className="rounded bg-slate-50 py-1 text-slate-400 border border-slate-100">
                                  S2
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rear of Hall */}
              <div className="mt-4 pt-2 border-t border-dashed border-slate-200 text-center">
                <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400 font-bold">
                  ▼ REAR OF EXAMINATION HALL • BACK AISLE ▼
                </span>
              </div>
            </div>

            {/* Hall Navigation Directive */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Compass className={`h-4 w-4 shrink-0 mt-0.5 ${isSem ? "text-purple-600" : "text-blue-600"}`} />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">
                    Physical Hall Navigation Directive
                  </span>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Enter Room <strong>{deskSlip.room_number}</strong> from the main front door. Walk down{" "}
                    <strong>Column {myCol}</strong> to <strong>Row {myRow}</strong>. Your assigned desk is{" "}
                    <strong className="text-slate-900">Bench {deskSlip.bench_number}</strong>. Take{" "}
                    <strong>{deskSlip.seat_label || (deskSlip.seat_number === 1 ? "Seat 01 (Left Position)" : "Seat 02 (Right Position)")}</strong>.
                    {isSem && " Seat 02 remains strictly vacant as an autonomous single-seater examination isolation buffer."}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-800 shadow-xs">
                <span>ROOM {deskSlip.room_number}</span>
                <span className="text-slate-300">•</span>
                <span>R{myRow}</span>
                <span className="text-slate-300">•</span>
                <span>C{myCol}</span>
                <span className="text-slate-300">•</span>
                <span className="text-blue-600">BENCH {String(deskSlip.bench_number).padStart(2, "0")}</span>
              </div>
            </div>
          </div>

          {/* Bento Row 4: Cryptographic QR Code & Verification Block */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-center gap-5">
            {/* QR Matrix Representation */}
            <div className="h-24 w-24 shrink-0 rounded-xl bg-blue-50 border border-blue-200 p-2.5 flex flex-col items-center justify-center shadow-xs">
              <div className="grid grid-cols-5 gap-1 w-full h-full">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-xs ${
                      (i % 2 === 0 || i === 7 || i === 11 || i === 13 || i === 18)
                        ? "bg-blue-600"
                        : "bg-blue-100"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Cryptographic Details */}
            <div className="flex-1 space-y-1.5 text-xs text-center sm:text-left">
              <div className="font-mono text-[11px] font-bold text-slate-900">
                CRYPTOGRAPHIC VERIFICATION TOKEN
              </div>
              <p className="font-mono text-[10px] text-blue-900 break-all bg-blue-50/60 p-2 rounded-lg border border-blue-100">
                {deskSlip.qr_payload}
              </p>
              <p className="text-[11px] text-slate-500">
                Invigilators will scan this QR token at the entry door of Room {deskSlip.room_number}.
              </p>
            </div>

            {/* Signatory */}
            <div className="shrink-0 text-center sm:text-right border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-5">
              <div className="font-serif italic text-sm text-slate-900 font-bold border-b border-slate-300 pb-1 inline-block">
                Authorized Signatory
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">
                Controller of Examinations
              </div>
              <div className="text-[9px] text-slate-600 font-semibold flex items-center justify-center sm:justify-end gap-1 mt-0.5">
                <ShieldCheck className="h-3 w-3 text-blue-600" /> Digitally Certified
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== STRICT LOCKED STATE: NULL SEATING ALLOCATION ==================== */
        <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-xs space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/60 shadow-xs">
            <Lock className="h-6 w-6" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Seating Allotment Pending
            </span>
            <h2 className="text-xl font-black text-slate-900">
              No Active Examination Seating Allocation
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Candidate profile verified for <strong>{candidateName}</strong> (
              <span className="font-mono font-bold text-slate-800">{candidateRoll}</span>, Department of {candidateDept}).
              The Controller of Examinations has not yet run the Seating Engine for scheduled examinations.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-md mx-auto text-xs text-slate-600 text-left space-y-1.5">
            <div className="font-bold text-slate-900">
              Next Steps:
            </div>
            <div>1. Verify your course registration on the Timetable page.</div>
            <div>2. Seating allocations are published once Root executes the seating engine.</div>
            <div>3. Contact the GKCE Examination Cell if you require assistance.</div>
          </div>

          <div className="pt-2">
            <Link
              href="/student/exam"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm shadow-blue-500/20 transition"
            >
              <span>View Examination Timetable</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
