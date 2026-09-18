"use client";

import React, { useEffect, useState } from "react";
import { registerServiceWorker, subscribeToPush } from "@/lib/notifications";
import { BellRing, X } from "lucide-react";

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  const triggerForegroundAlert = (payload: { title: string; body: string; vibrate?: number[] }) => {
    // Vibrate device natively if tab is open
    if ("vibrate" in navigator) {
      navigator.vibrate(payload.vibrate || [300, 100, 300, 100, 300]);
    }
    setToast({ title: payload.title, body: payload.body });
    setTimeout(() => setToast(null), 8000);
  };

  useEffect(() => {
    const init = async () => {
      // 1. Check Service Worker
      const registration = await registerServiceWorker();
      if (!registration) return;

      // 2. Check Push Permission
      if (Notification.permission === "default") {
        setShowPrompt(true);
      } else if (Notification.permission === "granted") {
        await subscribeToPush(registration);
      }

      // 3. Connect SSE for foreground real-time events
      const token = localStorage.getItem("gkce_exam_cell_auth_token");
      if (token) {
        // SSE natively doesn't support Authorization header easily, but browsers will send cookies. 
        // We use query parameter for simplicity in this demo environment if needed, 
        // or just standard token fetch in a regular polling mechanism.
        // Actually, since this is a quick implementation, we will use a polyfill approach 
        // or fetch-based SSE if needed, but for now we'll stick to Web Push primarily 
        // and add a generic setInterval fallback if SSE is too complex without cookies.
        
        // Actually, let's just listen to service worker messages for foreground toasts
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data && event.data.type === "PUSH_RECEIVED") {
            triggerForegroundAlert(event.data.payload);
          }
        });
      }
    };

    init();

    return () => {
      // Cleanup if needed
    };
  }, []);

  const handleAllow = async () => {
    setShowPrompt(false);
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const reg = await navigator.serviceWorker.ready;
      await subscribeToPush(reg);
    }
  };

  return (
    <>
      {children}
      
      {/* Banner for requesting permissions */}
      {showPrompt && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-50 w-11/12 max-w-md border border-slate-700">
          <div className="h-10 w-10 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
            <BellRing className="h-5 w-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold">Enable Exam Alerts</h4>
            <p className="text-xs text-slate-300 mt-0.5">Get notified instantly when seating is allocated.</p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={handleAllow} className="bg-blue-600 hover:bg-blue-500 text-xs font-bold px-3 py-1.5 rounded-lg transition">
              Allow
            </button>
            <button onClick={() => setShowPrompt(false)} className="text-xs text-slate-400 hover:text-white transition">
              Later
            </button>
          </div>
        </div>
      )}

      {/* Foreground Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 bg-white border border-slate-200 shadow-xl rounded-xl p-4 z-50 max-w-sm animate-in slide-in-from-right-8">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 text-blue-600">
                <BellRing className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{toast.title}</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{toast.body}</p>
              </div>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
