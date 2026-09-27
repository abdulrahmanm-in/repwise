"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { Routine } from "@/types";
import { Play, Plus, History, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export default function WorkoutsTab() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"routines" | "history">("routines");

  const routines = useLiveQuery(() => db.routines.toArray()) || [];
  const history =
    useLiveQuery(() =>
      db.workouts.where("isCompleted").equals(1).reverse().sortBy("endTime")
    ) || [];

  const handleStartRoutine = async (routine: Routine) => {
    const routineItems = await db.routineItems
      .where("routineId")
      .equals(routine.id)
      .sortBy("orderIndex");

    const workoutId = `w_${Date.now()}`;
    await db.workouts.add({
      id: workoutId,
      routineId: routine.id,
      title: routine.title,
      startTime: Date.now(),
      totalVolumeKg: 0,
      isCompleted: false,
    });

    for (const item of routineItems) {
      const weId = `we_${Date.now()}_${item.exerciseId}`;
      await db.workoutExercises.add({
        id: weId,
        workoutId,
        exerciseId: item.exerciseId,
        orderIndex: item.orderIndex,
      });

      for (let s = 1; s <= item.targetSets; s++) {
        await db.sets.add({
          id: `set_${Date.now()}_${item.exerciseId}_${s}`,
          workoutExerciseId: weId,
          workoutId,
          exerciseId: item.exerciseId,
          setIndex: s,
          setType: "normal",
          weightKg: item.targetWeightKg || 0,
          reps: item.targetReps || 0,
          isCompleted: false,
        });
      }
    }

    router.push("/workouts/active");
  };

  return (
    <div className="space-y-4">
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("routines")}
          className={clsx(
            "flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all",
            activeTab === "routines"
              ? "border-white text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          )}
        >
          <BookOpen className="w-4 h-4" /> Routines
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={clsx(
            "flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all",
            activeTab === "history"
              ? "border-white text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          )}
        >
          <History className="w-4 h-4" /> History
        </button>
      </div>

      {activeTab === "routines" ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center py-1">
            <span className="text-xs uppercase text-zinc-400 font-semibold tracking-wider">
              Templates ({routines.length})
            </span>
            <button
              onClick={async () => {
                const title = prompt("Routine Name (e.g. Push Day):");
                if (title) {
                  await db.routines.add({
                    id: `rt_${Date.now()}`,
                    title,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  });
                }
              }}
              className="text-xs bg-zinc-900 text-zinc-200 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> New Routine
            </button>
          </div>

          {routines.map((routine) => (
            <div
              key={routine.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-white text-sm">{routine.title}</h3>
                <span className="text-xs text-zinc-500">Configured Routine</span>
              </div>
              <button
                onClick={() => handleStartRoutine(routine)}
                className="bg-white text-black hover:bg-zinc-200 px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Start
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 border border-zinc-800 rounded-xl">
              No historical workouts registered yet.
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-sm text-white">{item.title}</h3>
                    <span className="text-xs text-zinc-500">
                      {new Date(item.startTime).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-semibold text-white">
                      {Math.round(item.totalVolumeKg)} kg
                    </span>
                    <span className="block text-[10px] text-zinc-500 uppercase">Volume</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}