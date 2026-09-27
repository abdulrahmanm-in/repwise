"use client";

import React from "react";
import { Plus, X, Play, Pause } from "lucide-react";

interface RestTimerModalProps {
  secondsRemaining: number | null;
  isRunning: boolean;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onAdd30: () => void;
}

export default function RestTimerModal({
  secondsRemaining,
  isRunning,
  onPause,
  onResume,
  onSkip,
  onAdd30,
}: RestTimerModalProps) {
  if (secondsRemaining === null) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-4 flex items-center justify-between">
      <div>
        <span className="text-[10px] tracking-wider uppercase font-semibold text-zinc-400 block">
          Rest Timer
        </span>
        <span className="text-2xl font-mono font-bold text-white">
          {formattedTime}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onAdd30}
          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-xs font-semibold text-zinc-200 flex items-center gap-1 hover:bg-zinc-700 border border-zinc-700"
        >
          <Plus className="w-3.5 h-3.5" /> 30s
        </button>
        <button
          onClick={isRunning ? onPause : onResume}
          className="p-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700"
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={onSkip}
          className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}