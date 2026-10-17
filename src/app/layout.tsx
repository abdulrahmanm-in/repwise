// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import ActiveSessionBar from "@/components/ActiveSessionBar";
import DesktopNotice from "@/components/DesktopNotice";

export const metadata: Metadata = {
  title: "Repwise | Local-First Workout Tracker",
  description: "Minimalist, offline-first workout logging and progress tracking.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Repwise",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark bg-black text-white">
      <body className="bg-zinc-950 text-white min-h-screen flex justify-center selection:bg-zinc-800 antialiased select-none">
        {/* Desktop informative banner */}
        <DesktopNotice />

        {/* Constrained Mobile Frame */}
        <div className="w-full max-w-md min-h-screen bg-black relative flex flex-col md:border-x md:border-zinc-900 shadow-2xl">
          <main className="flex-1 px-4 pt-4 pb-28">
            {children}
          </main>

          <ActiveSessionBar />
          <Navigation />
        </div>
      </body>
    </html>
  );
}