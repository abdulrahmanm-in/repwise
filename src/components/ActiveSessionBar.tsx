// src/components/ActiveSessionBar.tsx
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { usePathname, useRouter } from "next/navigation";
import { Flame, Play, Trash2 } from "lucide-react";
import { triggerAutoSync } from "@/lib/driveSync";
import { useState, useEffect } from "react";

export default function ActiveSessionBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [canShow, setCanShow] = useState(false);

  const activeWorkout = useLiveQuery(
    () => db.workouts.filter((w) => !w.isCompleted).first(),
    []
  );

  useEffect(() => {
    if (!activeWorkout) {
      setCanShow(false);
      return;
    }

    // If the workout was literally just started (< 1200ms ago), delay showing 
    // the banner to give the router time to transition to /workouts/active
    const ageMs = Date.now() - activeWorkout.startTime;
    if (ageMs < 1200) {
      setCanShow(false);
      const timer = setTimeout(() => {
        setCanShow(true);
      }, 1200 - ageMs);
      return () => clearTimeout(timer);
    } else {
      setCanShow(true);
    }
  }, [activeWorkout]);

  // Don't show if there's no active session, already on active workout page, 
  // or within the startup navigation window
  if (!activeWorkout || pathname === "/workouts/active" || !canShow) {
    return null;
  }

  const handleDiscard = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shouldDiscard = confirm(
      `Discard active session "${activeWorkout.title}"? All logged sets in this session will be deleted.`
    );
    if (!shouldDiscard) return;

    await db.workouts.delete(activeWorkout.id);
    await db.workoutExercises
      .where("workoutId")
      .equals(activeWorkout.id)
      .delete();
    await db.sets.where("workoutId").equals(activeWorkout.id).delete();
    triggerAutoSync();
  };

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
      <div className="max-w-md mx-auto bg-amber-500 text-black rounded-2xl p-2.5 px-3.5 shadow-xl flex items-center justify-between backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center gap-2.5 overflow-hidden pr-2">
          <span className="p-1.5 rounded-xl bg-black text-amber-400 shrink-0">
            <Flame className="w-4 h-4 animate-pulse" />
          </span>
          <div className="overflow-hidden">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block leading-none mb-0.5">
              Active Session
            </span>
            <p className="text-xs font-black truncate leading-tight">
              {activeWorkout.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleDiscard}
            title="Discard Session"
            className="p-2 bg-black/10 hover:bg-black/20 text-black rounded-xl transition-colors active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => router.push("/workouts/active")}
            className="bg-black hover:bg-zinc-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-transform active:scale-95 shadow"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Resume</span>
          </button>
        </div>
      </div>
    </div>
  );
}