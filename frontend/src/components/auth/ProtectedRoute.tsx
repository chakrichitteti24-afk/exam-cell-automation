"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@/types";
import { ShieldAlert, ArrowRight, LogOut, Lock } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const { user, role, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-500">Verifying GKCE Authorization...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || !role) {
    return null;
  }

  // Check Role-Based Access Control
  const hasAccess = allowedRoles.includes(role);

  if (!hasAccess) {
    const roleDashboardMap: Record<UserRole, string> = {
      ROOT: "/root/dashboard",
      INVIGILATOR: "/invigilator/dashboard",
      STUDENT: "/student/dashboard",
    };

    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-rose-200 bg-white/60 backdrop-blur-xl border-white/60 p-8 shadow-xl text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-inner">
            <Lock className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">
              403 Forbidden Access
            </span>
            <h2 className="text-xl font-black text-slate-900">
              Role Authorization Barrier
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              You are currently authenticated as <strong>{role}</strong> (
              <span className="font-mono">{user.email}</span>). This resource strictly requires{" "}
              <strong>{allowedRoles.join(" or ")}</strong> privileges.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => router.push(roleDashboardMap[role])}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
            >
              <span>Go to your {role} Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign In with a Different Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
