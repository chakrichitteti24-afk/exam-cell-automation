"use client";

import React, { useState } from "react";
import {
  Settings,
  Sliders,
  Building,
  Save,
  CheckCircle2,
  Shield,
  Layers,
} from "lucide-react";

export default function RootSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    collegeName: "Gokula Krishna College of Engineering",
    academicYear: "2026-2027 (Fall / Odd)",
    defaultBenchesPerRoom: 24,
    defaultSeatsPerBench: 2,
    strictBranchMixing: true,
    allowSameBranchFallback: true,
    bufferTimeMinutes: 15,
  });

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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
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
