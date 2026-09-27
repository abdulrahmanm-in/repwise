"use client";

import React from "react";
import { WorkoutSet, SetType } from "@/types";
import { Check } from "lucide-react";
import clsx from "clsx";

interface SetRowProps {
  set: WorkoutSet;
  previousWeight?: number;
  previousReps?: number;
  onUpdate: (updatedFields: Partial<WorkoutSet>) => void;
  onToggleComplete: () => void;
}

export default function SetRow({
  set,
  previousWeight,
  previousReps,
  onUpdate,
  onToggleComplete,
}: SetRowProps) {
  const getBadgeColor = (type: SetType) => {
    switch (type) {
      case "warmup":
        return "text-zinc-400 bg-zinc-800/80 border-zinc-700";
      case "dropset":
        return "text-zinc-300 bg-zinc-800 border-zinc-600";
      case "failure":
      case "amrap":
        return "text-white bg-zinc-800 border-zinc-500 font-bold";
      default:
        return "text-zinc-400 bg-zinc-900 border-zinc-800";
    }
  };

  return (
    <div
      className={clsx(
        "grid grid-cols-12 gap-2 items-center py-2 px-2 rounded-lg transition-colors",
        set.isCompleted ? "bg-zinc-900/40" : "bg-zinc-900"
      )}
    >
      <div className="col-span-2 flex items-center justify-center">
        <button
          onClick={() => {
            const types: SetType[] = ["normal", "warmup", "dropset", "failure", "amrap"];
            const nextType = types[(types.indexOf(set.setType) + 1) % types.length];
            onUpdate({ setType: nextType });
          }}
          className={clsx(
            "text-xs px-2 py-1 rounded font-semibold border transition-colors",
            getBadgeColor(set.setType)
          )}
        >
          {set.setType === "normal" ? set.setIndex : set.setType.slice(0, 1).toUpperCase()}
        </button>
      </div>

      <div className="col-span-3 text-center text-xs text-zinc-500 font-mono">
        {previousWeight !== undefined && previousReps !== undefined
          ? `${previousWeight} × ${previousReps}`
          : "—"}
      </div>

      <div className="col-span-3">
        <input
          type="number"
          step="0.5"
          placeholder="0"
          value={set.weightKg === 0 ? "" : set.weightKg}
          onChange={(e) => onUpdate({ weightKg: parseFloat(e.target.value) || 0 })}
          className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-400 rounded text-center text-sm py-1.5 font-mono text-white outline-none"
        />
      </div>

      <div className="col-span-2">
        <input
          type="number"
          placeholder="0"
          value={set.reps === 0 ? "" : set.reps}
          onChange={(e) => onUpdate({ reps: parseInt(e.target.value, 10) || 0 })}
          className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-400 rounded text-center text-sm py-1.5 font-mono text-white outline-none"
        />
      </div>

      <div className="col-span-2 flex justify-end">
        <button
          onClick={onToggleComplete}
          className={clsx(
            "w-8 h-8 rounded-md flex items-center justify-center transition-all",
            set.isCompleted
              ? "bg-emerald-600 text-white"
              : "bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-white"
          )}
        >
          <Check className="w-4 h-4 stroke-[3]" />
        </button>
      </div>
    </div>
  );
}