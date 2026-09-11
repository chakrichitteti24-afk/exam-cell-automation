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

  // If already authenticated, redirect to authorized dashboard
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

    // Role-specific redirect
    if (result.role === "ROOT") {
      router.push("/root/dashboard");
    } else if (result.role === "INVIGILATOR") {
      router.push("/invigilator/dashboard");
    } else if (result.role === "STUDENT") {
      router.push("/student/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-4">
        {/* Single White Bento Authorization Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-xs space-y-6">
          {/* Header */}
          <div className="text-center space-y-2.5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-200">
              <GraduationCap className="h-7 w-7" />
            </div>

            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                Gokula Krishna College of Engineering
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Autonomous Examination Cell Gateway
              </p>
            </div>

            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Strict Authorization Portal
              </span>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
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
            className="space-y-4 text-xs"
          >
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Institutional Email or Student Roll Number
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. admin@gkce.edu.in or 23CS001"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter account password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-sm shadow-blue-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            <span>Encrypted Session • Zero-Disclosure RBAC</span>
          </div>
        </div>

        {/* Outer Footer */}
        <p className="text-center text-[11px] text-slate-400">
          Gokula Krishna College of Engineering (GKCE) • Autonomous Exam Cell
        </p>
      </div>
    </div>
  );
}

