"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  DoorOpen,
  Calendar,
  Grid3X3,
  FileSpreadsheet,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/root/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Students",
    href: "/root/students",
    icon: Users,
  },
  {
    label: "Invigilators",
    href: "/root/invigilators",
    icon: UserCheck,
  },
  {
    label: "Rooms & Benches",
    href: "/root/rooms",
    icon: DoorOpen,
  },
  {
    label: "Exams",
    href: "/root/exams",
    icon: Calendar,
  },
  {
    label: "Seating Allocation",
    href: "/root/allocation",
    icon: Grid3X3,
    highlight: true,
  },
  {
    label: "Reports & Print",
    href: "/root/reports",
    icon: FileSpreadsheet,
  },
  {
    label: "Settings",
    href: "/root/settings",
    icon: Settings,
  },
];

interface RootSidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function RootSidebar({
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
}: RootSidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);

  const isMobileOpen = mobileOpen !== undefined ? mobileOpen : internalMobileOpen;
  const setIsMobileOpen = onMobileOpenChange || setInternalMobileOpen;

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 md:top-16 bottom-0 left-0 z-50 md:z-40 flex flex-col border-r border-slate-200 bg-white/60 backdrop-blur-xl border-white/60 transition-all duration-300 shadow-xl md:shadow-2xs",
          collapsed ? "w-64 md:w-20" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Mobile Drawer Header */}
        <div className="flex md:hidden items-center justify-between px-4 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-800 uppercase tracking-wide">
            <div className="h-6 w-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black">
              GK
            </div>
            <span>Exam Cell Admin</span>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Desktop Header / Collapse Toggle */}
        <div
          className={cn(
            "hidden md:flex items-center py-3 border-b border-slate-100",
            collapsed ? "justify-center px-2" : "justify-between px-4"
          )}
        >
          {!collapsed && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Exam Cell Admin
            </span>
          )}
          <button
            onClick={() => onCollapsedChange(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center rounded-xl text-xs font-semibold transition-all duration-150 group relative",
                  collapsed ? "md:justify-center md:px-0 px-3 py-2.5 gap-3" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  item.highlight && !isActive && "border border-blue-100 bg-blue-50/60 text-blue-700 hover:bg-blue-50"
                )}
                title={item.label}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                    isActive ? "text-white" : item.highlight ? "text-blue-600" : "text-slate-500"
                  )}
                />

                {/* Always show text on mobile, hide on desktop only when collapsed */}
                <span className={cn(
                  "truncate flex-1 flex items-center justify-between",
                  collapsed ? "md:hidden" : ""
                )}>
                  <span>{item.label}</span>
                  {item.highlight && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-mono font-bold",
                        isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                      )}
                    >
                      ENGINE
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Footer info & Logout */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          {(!collapsed || isMobileOpen) && (
            <div className={cn(
              "rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-[11px]",
              collapsed ? "md:hidden" : ""
            )}>
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Portal Online
              </div>
              <p className="text-slate-400 text-[10px] mt-0.5">
                Autonomous Academic Session
              </p>
            </div>
          )}

          <button
            onClick={logout}
            className={cn(
              "w-full flex items-center gap-2.5 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition",
              collapsed ? "md:justify-center md:px-0 px-3" : "px-3"
            )}
            title="Log Out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed ? "md:hidden" : "")}>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
