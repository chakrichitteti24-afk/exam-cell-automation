"use client";

import React, { useState } from "react";
import { RootSidebar } from "@/components/layout/RootSidebar";
import { Navbar } from "@/components/layout/Navbar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleToggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ROOT"]}>
      <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col">
        <Navbar
          showSidebarToggle={true}
          onToggleSidebar={handleToggleSidebar}
        />

        <div className="flex flex-1 relative min-h-[calc(100vh-4rem)] pt-16">
          <RootSidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            mobileOpen={mobileSidebarOpen}
            onMobileOpenChange={setMobileSidebarOpen}
          />
          {/* Main content: margin tracks sidebar width (w-64 expanded / w-20 collapsed) */}
          <div
            className={`flex-1 min-w-0 transition-all duration-300 ${
              sidebarCollapsed ? "md:ml-20" : "md:ml-64"
            }`}
          >
            <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
