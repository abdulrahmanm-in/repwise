// src/app/settings/data/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/db/database";
import { ArrowLeft, Trash2, History, BookOpen, Dumbbell, AlertTriangle } from "lucide-react";
import { triggerAutoSync } from "@/lib/driveSync";

export default function GranularDataManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const clearHistory = async () => {
    if (!confirm("Are you sure you want to delete all completed workout history? Your saved routines and custom exercises will remain.")) {
      return;
    }
    setLoading(true);
    await db.workouts.where("isCompleted").equals(1).delete();
    await db.workouts.filter((w) => Boolean(w.isCompleted)).delete();
    triggerAutoSync();
    setLoading(false);
    alert("Workout history cleared!");
  };

  const clearRoutines = async () => {
    if (!confirm("Are you sure you want to delete all saved routines?")) {
      return;
    }
    setLoading(true);
    await db.routines.clear();
    await db.routineItems.clear();
    triggerAutoSync();
    setLoading(false);
    alert("All routines cleared!");
  };

  const clearCustomExercises = async () => {
    if (!confirm("Are you sure you want to delete all custom exercises? Built-in exercises will not be deleted.")) {
      return;
    }
    setLoading(true);
    await db.exercises.filter((ex) => Boolean(ex.isCustom)).delete();
    triggerAutoSync();
    setLoading(false);
    alert("All custom exercises deleted!");
  };

  return (
    <div className="space-y-6 pb-28">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 pt-2">
        <button onClick={() => router.back()} className="text-zinc-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-white">Data Management</h1>
          <p className="text-[11px] text-zinc-400">Selectively erase specific records</p>
        </div>
      </div>

      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Changes made here take effect immediately in your local storage and automatically sync to your connected Google Drive backup.
        </p>
      </div>

      <div className="space-y-3">
        {/* Clear History */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Workout Logs & History</h3>
              <p className="text-xs text-zinc-500">Deletes past workout sessions and volume logs</p>
            </div>
          </div>
          <button
            disabled={loading}
            onClick={clearHistory}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        {/* Clear Routines */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Saved Routines</h3>
              <p className="text-xs text-zinc-500">Deletes all routine templates and their planned items</p>
            </div>
          </div>
          <button
            disabled={loading}
            onClick={clearRoutines}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        {/* Clear Custom Exercises */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400">
              <Dumbbell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Custom Exercises</h3>
              <p className="text-xs text-zinc-500">Deletes all created custom exercises from your library</p>
            </div>
          </div>
          <button
            disabled={loading}
            onClick={clearCustomExercises}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
}