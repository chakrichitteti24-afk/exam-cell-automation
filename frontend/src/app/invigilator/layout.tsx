"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { LayoutDashboard, DoorOpen, Calendar } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { cn } from "@/lib/utils";

export default function InvigilatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <ProtectedRoute allowedRoles={["INVIGILATOR"]}>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pt-16">
        <Navbar />

        {/* Invigilator Sub-Header Navigation */}
        <div className="border-b border-slate-200 bg-white/60 backdrop-blur-xl border-white/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-xs">
                INV
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>{user?.name || "Faculty Invigilator"}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                    {user?.metadata?.employeeId || "N/A"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Duty Dashboard
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Link
                href="/invigilator/dashboard"
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5",
                  pathname === "/invigilator/dashboard"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Duty Dashboard
              </Link>
              <Link
                href="/invigilator/rooms"
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5",
                  pathname === "/invigilator/rooms"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <DoorOpen className="h-3.5 w-3.5" />
                Assigned Room
              </Link>
              <Link
                href="/invigilator/exams"
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5",
                  pathname === "/invigilator/exams"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                My Exams
              </Link>
            </div>
          </div>
        </div>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
