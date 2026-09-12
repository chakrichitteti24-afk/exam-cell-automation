"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { GraduationCap } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { user, role, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && role) {
        if (role === "ROOT") router.replace("/root/dashboard");
        else if (role === "INVIGILATOR") router.replace("/invigilator/dashboard");
        else if (role === "STUDENT") router.replace("/student/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [isAuthenticated, role, isLoading, router]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 bg-white/60 backdrop-blur-xl border-white/60 p-8 rounded-2xl border border-slate-200 shadow-xs text-center max-w-sm w-full">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/25">
          <GraduationCap className="h-7 w-7" />
        </div>
        <div className="text-center">
          <h2 className="text-xs font-bold text-slate-900 tracking-wide uppercase">
            Gokula Krishna College of Engineering
          </h2>
          <p className="text-xs text-blue-600 mt-1 font-medium">
            Loading Examination Cell Portal...
          </p>
        </div>
      </div>
    </div>
  );
}
