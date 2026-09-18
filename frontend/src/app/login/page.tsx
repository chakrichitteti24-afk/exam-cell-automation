"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  ArrowRight,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { role, isAuthenticated, loginWithCredentials } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (isAuthenticated && role) {
      if (role === "ROOT") router.push("/root/dashboard");
      else if (role === "INVIGILATOR") router.push("/invigilator/dashboard");
      else if (role === "STUDENT") router.push("/student/dashboard");
    }
  }, [isAuthenticated, role, router]);

  const handleLogin = async (idToUse?: string, passToUse?: string) => {
    const finalId = idToUse || identifier;
    const finalPass = passToUse || password;

    if (!finalId.trim()) {
      setErrorMessage("Please enter your institutional email or Roll Number.");
      return;
    }
    if (!finalPass) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    const result = await loginWithCredentials(finalId, finalPass);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || "Authentication failed. Invalid credentials.");
      return;
    }

    if (result.role === "ROOT") router.push("/root/dashboard");
    else if (result.role === "INVIGILATOR") router.push("/invigilator/dashboard");
    else if (result.role === "STUDENT") router.push("/student/dashboard");
  };

  return (
    <div className="flex-1 min-h-[calc(100dvh-3.5rem)] relative flex flex-col justify-center items-center px-4 py-3 sm:px-6 z-10 w-full">
      <div className="w-full max-w-md my-auto relative space-y-3">
        {/* Glassmorphic Authorization Card */}
        <div className="rounded-2xl sm:rounded-3xl border border-white/60 bg-white/40 backdrop-blur-xl p-5 sm:p-7 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] space-y-4 sm:space-y-5">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30">
              <GraduationCap className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                Gokula Krishna College of Engineering
              </h1>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-600 mt-0.5">
                Autonomous Examination Cell Gateway
              </p>
            </div>

            <div className="pt-0.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/50 text-blue-800 border border-white shadow-2xs backdrop-blur-sm">
                <ShieldCheck className="h-3 w-3" />
                Strict Authorization Portal
              </span>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50/80 backdrop-blur-sm border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shadow-2xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-3.5 text-xs"
          >
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Institutional Email or Student Roll Number
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. your_email@gkce.edu.in or Roll Number"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/60 bg-white/50 backdrop-blur-sm focus:bg-white/80 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-semibold shadow-inner transition text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter account password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full pl-9 pr-10 py-2 rounded-xl border border-white/60 bg-white/50 backdrop-blur-sm focus:bg-white/80 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-semibold shadow-inner transition text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-800 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 mt-1 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01]"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>Authenticate & Access Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Card Footer Security Verification */}
          <div className="pt-3 border-t border-slate-200/50 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-bold">
            <Lock className="h-3 w-3" />
            <span>Encrypted Session • Zero-Disclosure RBAC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
