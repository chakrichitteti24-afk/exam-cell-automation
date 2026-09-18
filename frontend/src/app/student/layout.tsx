"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { cn } from "@/lib/utils";
import NotificationProvider from "@/components/NotificationProvider";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <ProtectedRoute allowedRoles={["STUDENT"]}>
      <NotificationProvider>
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pt-16">
          <Navbar />

          {/* Candidate Mobile Header */}
          <div className="bg-white/60 backdrop-blur-xl border-white/60 border-b border-slate-200">
            <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : "ST"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 truncate">
                      {user?.name || "Student"}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                      {user?.metadata?.rollNumber || "N/A"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    B.Tech {user?.metadata?.department || "General"} • Active Candidate
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs shrink-0">
                <Link
                  href="/student/dashboard"
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl font-bold transition touch-target sm:touch-auto flex items-center justify-center",
                    pathname === "/student/dashboard"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  Desk Slip
                </Link>
                <Link
                  href="/student/exam"
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl font-bold transition touch-target sm:touch-auto flex items-center justify-center",
                    pathname === "/student/exam"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  Schedule
                </Link>
              </div>
            </div>
          </div>

          <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </NotificationProvider>
    </ProtectedRoute>
  );
}
