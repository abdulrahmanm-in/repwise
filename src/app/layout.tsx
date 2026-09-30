// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import ActiveSessionBar from "@/components/ActiveSessionBar";

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
      <head>
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body className="min-h-screen pb-20 select-none antialiased">
        <main className="max-w-md mx-auto px-4 pt-4">{children}</main>
        <ActiveSessionBar />
        <Navigation />
      </body>
    </html>
  );
}