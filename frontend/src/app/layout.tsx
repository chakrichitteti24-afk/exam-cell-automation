import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: "Exam Cell Automation System | Gokula Krishna College of Engineering",
  description:
    "Autonomous examination seating allocation, hall capacity management, and invigilation portal for Gokula Krishna College of Engineering (GKCE).",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased light`}
      data-theme="light"
      style={{ colorScheme: "light" }}
    >
      <body
        className="min-h-full flex flex-col font-sans bg-transparent text-slate-900 relative overflow-x-hidden"
        style={{ colorScheme: "light" }}
      >
        {/* Global Clean Academic Background */}
        <div className="fixed inset-0 z-[-1] pointer-events-none bg-slate-50/60" />

        <AuthProvider>
          <div className="flex-1 flex flex-col">
            {children}
          </div>
          
          {/* Global Attribution Footer */}
          <footer className="py-4 text-center z-40 bg-white/40 backdrop-blur-sm border-t border-slate-200/50 mt-auto">
            <p className="text-[11px] font-medium text-slate-500 flex items-center justify-center gap-1">
              Engineered & Designed by
              <a 
                href="https://cipherflux-labs.vercel.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-bold text-blue-600 hover:text-blue-700 transition flex items-center gap-1 ml-0.5"
              >
                Cipherflux Labs
              </a>
            </p>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
