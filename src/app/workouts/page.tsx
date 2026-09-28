"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { Routine, Exercise } from "@/types";
import { Play, Plus, History, BookOpen, Trash2, X, Dumbbell } from "lucide-react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export default function WorkoutsTab() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"routines" | "history">("routines");

  // In-Page Routine Creator Modal State
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [routineTitle, setRoutineTitle] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<{ exercise: Exercise; sets: number; reps: number }[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  const routines = useLiveQuery(() => db.routines.toArray()) || [];
  const exercises = useLiveQuery(() => db.exercises.toArray()) || [];
  const history = useLiveQuery(() =>
    db.workouts.where("isCompleted").equals(1).reverse().sortBy("endTime")
  ) || [];

  const handleSaveRoutine = async () => {
    if (!routineTitle.trim()) return;
    const routineId = `rt_${Date.now()}`;

    await db.routines.add({
      id: routineId,
      title: routineTitle.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    for (let i = 0; i < selectedExercises.length; i++) {
      const item = selectedExercises[i];
      await db.routineItems.add({
        id: `ri_${Date.now()}_${i}`,
        routineId,
        exerciseId: item.exercise.id,
        orderIndex: i + 1,
        targetSets: item.sets,
        targetReps: item.reps,
        restSeconds: 90,
      });
    }

    setRoutineTitle("");
    setSelectedExercises([]);
    setIsCreatingRoutine(false);
  };

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
    <div className="space-y-4 pb-24">
      {/* Tab Switcher */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("routines")}
          className={clsx(
            "flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all",
            activeTab === "routines" ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
          )}
        >
          <BookOpen className="w-4 h-4" /> Routines
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={clsx(
            "flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all",
            activeTab === "history" ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
          )}
        >
          <History className="w-4 h-4" /> History
        </button>
      </div>

      {activeTab === "routines" ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center py-1">
            <span className="text-xs uppercase text-zinc-400 font-semibold tracking-wider">
              My Routines ({routines.length})
            </span>
            <button
              onClick={() => setIsCreatingRoutine(true)}
              className="text-xs bg-zinc-900 text-white hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700 flex items-center gap-1 font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Plan Routine
            </button>
          </div>

          {routines.map((routine) => (
            <div
              key={routine.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-white text-sm">{routine.title}</h3>
                <span className="text-xs text-zinc-500">Saved Template</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    await db.routines.delete(routine.id);
                    await db.routineItems.where("routineId").equals(routine.id).delete();
                  }}
                  className="p-2 text-zinc-500 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleStartRoutine(routine)}
                  className="bg-white text-black hover:bg-zinc-200 px-3.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Start
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 border border-zinc-800 rounded-xl">
              No historical workouts logged yet.
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
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

      {/* In-Page Routine Builder Modal */}
      {isCreatingRoutine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-2xl p-5 max-h-[85vh] flex flex-col space-y-4 pb-28 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h2 className="font-bold text-base text-white">Create Workout Routine</h2>
              <button onClick={() => setIsCreatingRoutine(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider font-semibold block mb-1">
                Routine Name
              </label>
              <input
                type="text"
                placeholder="e.g. Upper Body Push"
                value={routineTitle}
                onChange={(e) => setRoutineTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                  Exercises ({selectedExercises.length})
                </label>
                <button
                  onClick={() => setShowExercisePicker(true)}
                  className="text-xs text-white bg-zinc-800 px-2.5 py-1 rounded-md border border-zinc-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Exercise
                </button>
              </div>

              {selectedExercises.map((item, index) => (
                <div key={index} className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{item.exercise.name}</h4>
                    <span className="text-xs text-zinc-500">{item.sets} Sets × {item.reps} Reps</span>
                  </div>
                  <button
                    onClick={() => setSelectedExercises(prev => prev.filter((_, i) => i !== index))}
                    className="text-zinc-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                disabled={!routineTitle.trim() || selectedExercises.length === 0}
                onClick={handleSaveRoutine}
                className="w-full py-3 bg-white text-black font-bold rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-200 transition-all"
              >
                Save Routine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nested Exercise Picker for Routine Creator */}
      {showExercisePicker && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-end">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-2xl p-4 max-h-[75vh] flex flex-col pb-24">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
              <h3 className="font-semibold text-sm text-white">Select Exercise</h3>
              <button onClick={() => setShowExercisePicker(false)} className="text-xs text-zinc-400">Cancel</button>
            </div>
            <div className="overflow-y-auto divide-y divide-zinc-800/60">
              {exercises.map((e) => (
                <div
                  key={e.id}
                  onClick={() => {
                    setSelectedExercises(prev => [...prev, { exercise: e, sets: 3, reps: 10 }]);
                    setShowExercisePicker(false);
                  }}
                  className="py-3 px-2 flex justify-between items-center hover:bg-zinc-800 cursor-pointer rounded"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{e.name}</p>
                    <span className="text-xs text-zinc-500">{e.targetMuscle} • {e.equipment}</span>
                  </div>
                  <Plus className="w-4 h-4 text-zinc-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
