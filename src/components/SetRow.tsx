// src/components/SetRow.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { WorkoutSet, SetType } from "@/types";
import { Check, X } from "lucide-react";
import clsx from "clsx";

interface SetRowProps {
  set: WorkoutSet;
  previousWeight?: number;
  previousReps?: number;
  onUpdate: (updatedFields: Partial<WorkoutSet>) => void;
  onToggleComplete: () => void;
  onDelete?: () => void;
}

const TYPE_OPTIONS: SetType[] = ["normal", "warmup", "dropset", "failure", "amrap"];

export default function SetRow({
  set,
  previousWeight,
  previousReps,
  onUpdate,
  onToggleComplete,
  onDelete,
}: SetRowProps) {
  const [showActionMenu, setShowActionMenu] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const getBadgeColor = (type: SetType) => {
    switch (type) {
      case "warmup":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "dropset":
        return "text-purple-300 bg-purple-500/10 border-purple-500/20";
      case "failure":
      case "amrap":
        return "text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold";
      default:
        return "text-zinc-400 bg-zinc-900 border-zinc-800";
    }
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = () => {
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      setShowActionMenu(true);
    }, 450);
  };

  const handleTypeChange = (type: SetType) => {
    onUpdate({ setType: type });
    setShowActionMenu(false);
  };

  return (
    <div className="relative">
      <div
        className={clsx(
          "grid grid-cols-12 gap-2 items-center py-2 px-2 rounded-xl transition-colors",
          set.isCompleted ? "bg-zinc-900/40" : "bg-zinc-900"
        )}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("input") || target.closest("button")) return;
          setShowActionMenu(true);
        }}
      >
        {/* Set Number & Type Toggle */}
        <div className="col-span-2 flex items-center justify-center">
          <button
            type="button"
            onPointerDown={startLongPress}
            onPointerUp={clearLongPress}
            onPointerLeave={clearLongPress}
            onPointerCancel={clearLongPress}
            onContextMenu={(e) => {
              e.preventDefault();
              setShowActionMenu(true);
            }}
            onClick={(e) => {
              e.stopPropagation();
              setShowActionMenu(true);
            }}
            className={clsx(
              "text-xs px-2.5 py-1 rounded-lg font-semibold border transition-colors",
              getBadgeColor(set.setType)
            )}
            title="Open set actions"
          >
            {set.setType === "normal" ? set.setIndex : set.setType.slice(0, 1).toUpperCase()}
          </button>
        </div>

        {/* Previous Performance */}
        <div className="col-span-3 text-center text-xs text-zinc-500 font-mono">
          {previousWeight !== undefined && previousReps !== undefined
            ? `${previousWeight} × ${previousReps}`
            : "—"}
        </div>

        {/* Weight Input */}
        <div className="col-span-3">
          <input
            type="number"
            step="0.5"
            placeholder="0"
            value={set.weightKg === 0 ? "" : set.weightKg}
            onChange={(e) => onUpdate({ weightKg: parseFloat(e.target.value) || 0 })}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-lg text-center text-sm py-1.5 font-mono text-white outline-none"
          />
        </div>

        {/* Reps Input */}
        <div className="col-span-2">
          <input
            type="number"
            placeholder="0"
            value={set.reps === 0 ? "" : set.reps}
            onChange={(e) => onUpdate({ reps: parseInt(e.target.value, 10) || 0 })}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-lg text-center text-sm py-1.5 font-mono text-white outline-none"
          />
        </div>

        {/* Complete toggle */}
        <div className="col-span-2 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onToggleComplete}
            className={clsx(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              set.isCompleted
                ? "bg-emerald-600 text-white"
                : "bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-white"
            )}
            title="Mark set complete"
          >
            <Check className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>

      {showActionMenu && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          onClick={() => setShowActionMenu(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950/95 p-3.5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Set Actions</span>
              <button
                type="button"
                onClick={() => setShowActionMenu(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              {TYPE_OPTIONS.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={clsx(
                    "w-full rounded-lg border px-2 py-2 text-left text-xs font-semibold transition-colors",
                    set.setType === type
                      ? "bg-white text-black border-white"
                      : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:border-zinc-500"
                  )}
                >
                  {type === "normal"
                    ? "Normal"
                    : type === "warmup"
                    ? "Warmup"
                    : type === "dropset"
                    ? "Drop Set"
                    : type === "failure"
                    ? "Failure"
                    : "AMRAP"}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  onDelete?.();
                  setShowActionMenu(false);
                }}
                className="mt-1 w-full rounded-lg bg-rose-600 text-white font-bold text-xs py-2.5 px-2 hover:bg-rose-500 transition-colors"
              >
                Delete Set
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}