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
        className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900"
        style={{ colorScheme: "light" }}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
