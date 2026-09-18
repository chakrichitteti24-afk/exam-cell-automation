"use client";

import React, { useState, useEffect } from "react";
import {
  Sliders,
  Building,
  Save,
  CheckCircle2,
  Layers,
  Database,
  RefreshCw,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";

export default function RootSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    database_type: string;
    is_neon: boolean;
    is_connected: boolean;
    latency_ms: number;
    records_summary: Record<string, number>;
  } | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState("");

  const [settings, setSettings] = useState({
    collegeName: "Gokula Krishna College of Engineering",
    academicYear: "2026-2027 (Fall / Odd)",
    defaultBenchesPerRoom: 24,
    defaultSeatsPerBench: 2,
    strictBranchMixing: true,
    allowSameBranchFallback: true,
    bufferTimeMinutes: 15,
  });

  const loadDbStatus = async () => {
    setDbLoading(true);
    try {
      const res = await api.system.getStatus();
      setDbStatus(res);
    } catch (err) {
      console.error("Failed to load DB status:", err);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    loadDbStatus();
  }, []);

  const handlePurgeData = async () => {
    if (
      !window.confirm(
        "Are you sure you want to purge all demo data (students, invigilators, rooms, exams, allocations)? Your Root Admin account will be preserved."
      )
    ) {
      return;
    }
    setPurging(true);
    setPurgeMsg("");
    try {
      const res = await api.system.clearData();
      setPurgeMsg(res.message || "Data purged successfully.");
      await loadDbStatus();
    } catch (err) {
      alert(`Purge failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setPurging(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            System & Examination Settings
          </h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            Global Config
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Configure default room capacity assumptions, branch-mixing constraints, and college profile.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Branch Mixing Algorithm Configuration */}
        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Sliders className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Branch-Mixing Algorithm Rules
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="font-bold text-slate-800 block">
                  Enforce Alternate Branch Pairing
                </span>
                <span className="text-[11px] text-slate-500">
                  Prefer pairing CSE + ECE, CSE + EEE on the same physical bench over same-department students.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.strictBranchMixing}
                onChange={(e) =>
                  setSettings({ ...settings, strictBranchMixing: e.target.checked })
                }
                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="font-bold text-slate-800 block">
                  Allow Same-Branch Fallback with Warning
                </span>
                <span className="text-[11px] text-slate-500">
                  If student distribution has branch count parity imbalance, pair same branch on leftover benches instead of failing.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.allowSameBranchFallback}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    allowSameBranchFallback: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Room & Bench Defaults */}
        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Layers className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Default Room & Bench Standards
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700">
                Default Benches per Room
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={settings.defaultBenchesPerRoom}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultBenchesPerRoom: Number(e.target.value),
                  })
                }
                className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Standard college configuration: 24 benches
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700">
                Students per Bench (Seats)
              </label>
              <input
                type="number"
                min={1}
                max={4}
                value={settings.defaultSeatsPerBench}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultSeatsPerBench: Number(e.target.value),
                  })
                }
                className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Standard bench capacity: 2 students (Seat 01 & Seat 02)
              </span>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900">
            Standard Default Room Capacity:{" "}
            <strong>
              {settings.defaultBenchesPerRoom * settings.defaultSeatsPerBench} Students
            </strong>
          </div>
        </div>

        {/* Institution Details */}
        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Institution Profile & Academic Session
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700">
                College / Institution Name
              </label>
              <input
                type="text"
                value={settings.collegeName}
                onChange={(e) =>
                  setSettings({ ...settings, collegeName: e.target.value })
                }
                className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700">
                Current Academic Session
              </label>
              <input
                type="text"
                value={settings.academicYear}
                onChange={(e) =>
                  setSettings({ ...settings, academicYear: e.target.value })
                }
                className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Database & Storage Status */}
        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Database & Cloud Storage Status
              </h2>
            </div>
            <button
              type="button"
              onClick={loadDbStatus}
              disabled={dbLoading}
              className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 transition"
            >
              <RefreshCw className={`h-3 w-3 ${dbLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">Engine / Cloud:</span>
                  <span className="font-mono text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {dbStatus?.database_type || "Detecting..."}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                  <span>
                    Status:{" "}
                    <strong className={dbStatus?.is_connected ? "text-emerald-600" : "text-rose-600"}>
                      {dbStatus?.is_connected ? "● Connected & Healthy" : "○ Disconnected"}
                    </strong>
                  </span>
                  {dbStatus?.latency_ms !== undefined && dbStatus.latency_ms > 0 && (
                    <span>Latency: <strong>{dbStatus.latency_ms} ms</strong></span>
                  )}
                </div>
              </div>
            </div>

            {/* Current Record Counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Students</span>
                <span className="text-base font-black text-slate-900">{dbStatus?.records_summary?.students ?? 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Invigilators</span>
                <span className="text-base font-black text-slate-900">{dbStatus?.records_summary?.invigilators ?? 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Rooms</span>
                <span className="text-base font-black text-slate-900">{dbStatus?.records_summary?.rooms ?? 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Scheduled Exams</span>
                <span className="text-base font-black text-slate-900">{dbStatus?.records_summary?.exams ?? 0}</span>
              </div>
            </div>

            {/* Maintenance & Reset Action */}
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Purge Demonstration Data</span>
                </div>
                <p className="text-[11px] text-rose-600">
                  Clears all test students, invigilators, rooms, and allocations. Preserves the Root Admin account and institutional departments.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePurgeData}
                disabled={purging}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                {purging ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>Clear All Demo Data</span>
              </button>
            </div>

            {purgeMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{purgeMsg}</span>
              </div>
            )}
          </div>
        </div>

        {saved && (
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Settings saved successfully!
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-200 transition"
          >
            <Save className="h-4 w-4" />
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
