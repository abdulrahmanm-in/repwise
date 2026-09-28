// src/components/LoadingOverlay.tsx
"use client";

import { Dumbbell } from "lucide-react";

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export default function LoadingOverlay({
  isLoading,
  message = "Loading Repwise...",
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        {/* Pulsing App Icon */}
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse">
          <Dumbbell className="w-8 h-8 text-white animate-spin" />
        </div>
        <p className="text-xs font-medium tracking-wide text-zinc-400">
          {message}
        </p>
      </div>
    </div>
  );
}
