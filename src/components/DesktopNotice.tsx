// src/components/DesktopNotice.tsx
"use client";

import { useState, useEffect } from "react";
import { Smartphone, X, Monitor } from "lucide-react";

export default function DesktopNotice() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Only show if user hasn't dismissed it during this session
    const isDismissed = sessionStorage.getItem("repwise_desktop_notice_dismissed");
    if (!isDismissed) {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem("repwise_desktop_notice_dismissed", "true");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    // Hidden on mobile (<768px), visible as an unobtrusive bottom-right toast on desktop
    <aside
      aria-label="Desktop view notice"
      className="hidden md:flex fixed bottom-6 right-6 z-[99999] max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl flex-col gap-3 text-left animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white shrink-0">
          <Monitor className="w-5 h-5 text-zinc-300" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
              Desktop Mode
            </span>
          </div>
          <h2 className="text-xs font-bold text-white mt-1">Review & Plan on Desktop</h2>
          <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
            You can plan routines, review analytics, and test features here. For live workout logging and rest timers between sets, Repwise is best installed on your phone.
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className="text-zinc-500 hover:text-white p-1 rounded-lg transition-colors"
          title="Dismiss notice"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1 text-zinc-400">
          <Smartphone className="w-3 h-3 text-zinc-500" /> Install PWA on your mobile browser
        </span>
        <button
          onClick={handleDismiss}
          className="text-white hover:underline font-medium ml-2"
        >
          Got it
        </button>
      </div>
    </aside>
  );
}