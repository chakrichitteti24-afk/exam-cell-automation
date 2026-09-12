"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  GraduationCap,
  LogOut,
  ShieldCheck,
  UserCheck,
  User,
  Menu,
} from "lucide-react";

interface NavbarProps {
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
  isSidebarOpen?: boolean;
}

export function Navbar({
  onToggleSidebar,
  showSidebarToggle = false,
}: NavbarProps = {}) {
  const { user, role, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const roleBadgeConfig = {
    ROOT: {
      label: "ADMIN / ROOT",
      badgeClass: "bg-blue-600 text-white shadow-xs shadow-blue-500/20",
      icon: ShieldCheck,
    },
    INVIGILATOR: {
      label: "FACULTY INVIGILATOR",
      badgeClass: "bg-blue-600 text-white shadow-xs shadow-blue-500/20",
      icon: UserCheck,
    },
    STUDENT: {
      label: "STUDENT",
      badgeClass: "bg-blue-600 text-white shadow-xs shadow-blue-500/20",
      icon: User,
    },
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-2xs">
      <div className="flex h-16 items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Left: Institution Branding & Sidebar Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {showSidebarToggle && (
            <button
              onClick={onToggleSidebar}
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition shadow-2xs"
              aria-label="Toggle Navigation Menu"
              title="Toggle Menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
          <Link
          href={
            isAuthenticated
              ? role === "ROOT"
                ? "/root/dashboard"
                : role === "INVIGILATOR"
                ? "/invigilator/dashboard"
                : "/student/dashboard"
              : "/login"
          }
          className="flex items-center gap-2.5 sm:gap-3 shrink-0"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-xs sm:text-sm tracking-tight text-slate-900 uppercase truncate max-w-[200px] xs:max-w-[280px] sm:max-w-none">
                <span className="sm:hidden">GKCE</span>
                <span className="hidden sm:inline">Gokula Krishna College of Engineering</span>
              </span>
              <span className="hidden md:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 shrink-0">
                AUTONOMOUS
              </span>
            </div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-500 truncate">
              Examination Cell Automation Portal
            </p>
          </div>
        </Link>
      </div>

        {/* Right: User Information & Sign Out */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isAuthenticated && user && role ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Verified Role Badge */}
              <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide ${roleBadgeConfig[role].badgeClass}`}
                >
                  {roleBadgeConfig[role].label}
                </span>
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 truncate max-w-[140px]">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                    {user.metadata?.rollNumber || user.metadata?.employeeId || user.email}
                  </div>
                </div>
              </div>

              {/* Secure Logout */}
              <button
                onClick={handleLogout}
                title="Secure Sign Out"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 text-xs font-medium transition shadow-2xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/20 transition"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
