import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Exam Cell Automation System | Gokula Krishna College of Engineering",
  description:
    "Autonomous examination seating allocation, hall capacity management, and invigilation portal for Gokula Krishna College of Engineering (GKCE).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased light`}
      data-theme="light"
      style={{ colorScheme: "light" }}
    >
      <body
        className="min-h-full flex flex-col font-sans bg-transparent text-slate-900 relative overflow-x-hidden"
        style={{ colorScheme: "light" }}
      >
        {/* Global Glassmorphic Background */}
        <div className="fixed inset-0 z-[-1] pointer-events-none bg-gradient-to-br from-indigo-50 via-slate-50 to-cyan-50">
          <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-purple-300/30 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-cyan-300/30 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-pulse" style={{ animationDelay: "2s" }}></div>
          <div className="absolute top-[20%] right-[20%] w-[30rem] h-[30rem] bg-blue-300/30 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse" style={{ animationDelay: "4s" }}></div>
        </div>

        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
