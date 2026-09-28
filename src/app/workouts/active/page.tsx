"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { WorkoutExercise, Exercise, WorkoutSet } from "@/types";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCheck, Trash2, ArrowLeft, Timer, TimerOff } from "lucide-react";
import SetRow from "@/components/SetRow";
import RestTimerModal from "@/components/RestTimerModal";
import { useRestTimer } from "@/hooks/useRestTimer";
import { calculateWorkoutVolume } from "@/lib/formulas";

export default function ActiveWorkoutView() {
  const router = useRouter();
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);

  const activeWorkout = useLiveQuery(
    () => db.workouts.filter((w) => !w.isCompleted).first(),
    []
  );

  const workoutExercises =
    useLiveQuery<WorkoutExercise[]>(
      () =>
        activeWorkout
          ? db.workoutExercises
              .where("workoutId")
              .equals(activeWorkout.id)
              .sortBy("orderIndex")
          : Promise.resolve<WorkoutExercise[]>([]),
      [activeWorkout]
    ) ?? [];

  const sets =
    useLiveQuery<WorkoutSet[]>(
      () =>
        activeWorkout
          ? db.sets.where("workoutId").equals(activeWorkout.id).toArray()
          : Promise.resolve<WorkoutSet[]>([]),
      [activeWorkout]
    ) ?? [];

  const completedHistorySets =
    useLiveQuery<WorkoutSet[]>(
      () => db.sets.where("isCompleted").equals(1).toArray(),
      []
    ) ?? [];

  const exercises =
    useLiveQuery<Exercise[]>(() => db.exercises.toArray(), []) ?? [];
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  const {
    secondsRemaining,
    isRunning,
    startTimer,
    pauseTimer,
    resumeTimer,
    skipTimer,
    addThirtySeconds,
  } = useRestTimer();

  if (!activeWorkout) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-sm text-zinc-400">No active workout session found.</p>
        <button
          onClick={async () => {
            const id = `w_${Date.now()}`;
            await db.workouts.add({
              id,
              title: "Quick Workout",
              startTime: Date.now(),
              totalVolumeKg: 0,
              isCompleted: false,
            });
          }}
          className="bg-white text-black font-semibold px-4 py-2 rounded-xl text-sm hover:bg-zinc-200 transition-colors"
        >
          Start Empty Workout
        </button>
      </div>
    );
  }

  const handleFinishWorkout = async () => {
    const totalVolume = calculateWorkoutVolume(sets);
    await db.workouts.update(activeWorkout.id, {
      endTime: Date.now(),
      totalVolumeKg: totalVolume,
      isCompleted: true,
    });
    router.push("/workouts");
  };

  const handleAddExerciseToWorkout = async (exercise: Exercise) => {
    const weId = `we_${Date.now()}_${exercise.id}`;
    await db.workoutExercises.add({
      id: weId,
      workoutId: activeWorkout.id,
      exerciseId: exercise.id,
      orderIndex: workoutExercises.length + 1,
    });

    await db.sets.add({
      id: `s_${Date.now()}_1`,
      workoutExerciseId: weId,
      workoutId: activeWorkout.id,
      exerciseId: exercise.id,
      setIndex: 1,
      setType: "normal",
      weightKg: 0,
      reps: 0,
      isCompleted: false,
    });

    setShowExerciseSelector(false);
  };

  const handleAddSet = async (we: WorkoutExercise) => {
    const targetSets = sets.filter((s) => s.workoutExerciseId === we.id);
    const lastSet = targetSets[targetSets.length - 1];

    await db.sets.add({
      id: `s_${Date.now()}_${targetSets.length + 1}`,
      workoutExerciseId: we.id,
      workoutId: activeWorkout.id,
      exerciseId: we.exerciseId,
      setIndex: targetSets.length + 1,
      setType: "normal",
      weightKg: lastSet ? lastSet.weightKg : 0,
      reps: lastSet ? lastSet.reps : 0,
      isCompleted: false,
    });
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <button
          onClick={() => router.back()}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-white truncate max-w-[180px]">
          {activeWorkout.title}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRestTimerEnabled(!restTimerEnabled)}
            title={restTimerEnabled ? "Rest Timer Enabled" : "Rest Timer Disabled"}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700 transition-colors"
          >
            {restTimerEnabled ? (
              <Timer className="w-4 h-4 text-emerald-400" />
            ) : (
              <TimerOff className="w-4 h-4 text-zinc-500" />
            )}
          </button>
          <button
            onClick={handleFinishWorkout}
            className="bg-white text-black font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm hover:bg-zinc-200 transition-all active:scale-95"
          >
            <CheckCheck className="w-4 h-4" /> Finish
          </button>
        </div>
      </div>

      {/* Exercises Section */}
      <div className="space-y-4">
        {workoutExercises.map((we) => {
          const exercise = exerciseMap.get(we.exerciseId);
          const exerciseSets = sets
            .filter((s) => s.workoutExerciseId === we.id)
            .sort((a, b) => a.setIndex - b.setIndex);

          const pastSets = completedHistorySets
            .filter(
              (s) =>
                s.exerciseId === we.exerciseId && s.workoutId !== activeWorkout.id
            )
            .slice(-exerciseSets.length);

          return (
            <div
              key={we.id}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 space-y-3"
            >
              <div className="flex justify-between items-center px-1">
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    {exercise?.name || "Exercise"}
                  </h3>
                  <span className="text-[10px] text-zinc-500">
                    {exercise?.targetMuscle} • {exercise?.equipment}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    await db.workoutExercises.delete(we.id);
                    await db.sets.where("workoutExerciseId").equals(we.id).delete();
                  }}
                  className="text-zinc-600 hover:text-white p-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-semibold text-zinc-500 px-2">
                <span className="col-span-2 text-center">Set</span>
                <span className="col-span-3 text-center">Previous</span>
                <span className="col-span-3 text-center">Kg</span>
                <span className="col-span-2 text-center">Reps</span>
                <span className="col-span-2 text-right">Done</span>
              </div>

              <div className="space-y-1.5">
                {exerciseSets.map((s, index) => {
                  const ghost = pastSets[index];
                  return (
                    <SetRow
                      key={s.id}
                      set={s}
                      previousWeight={ghost?.weightKg}
                      previousReps={ghost?.reps}
                      onUpdate={(fields) => db.sets.update(s.id, fields)}
                      onToggleComplete={async () => {
                        const updatedStatus = !s.isCompleted;
                        await db.sets.update(s.id, {
                          isCompleted: updatedStatus,
                          completedAt: updatedStatus ? Date.now() : undefined,
                        });
                        if (updatedStatus && restTimerEnabled) {
                          startTimer(90);
                        }
                      }}
                    />
                  );
                })}
              </div>

              <button
                onClick={() => handleAddSet(we)}
                className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 flex items-center justify-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Set
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setShowExerciseSelector(true)}
        className="w-full py-3 border border-dashed border-zinc-800 hover:border-zinc-500 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Add Exercise
      </button>

      {/* Exercise Picker Modal */}
      {showExerciseSelector && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-2xl p-4 max-h-[80vh] flex flex-col pb-24">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
              <h2 className="font-semibold text-sm text-white">Select Exercise</h2>
              <button
                onClick={() => setShowExerciseSelector(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto py-2 divide-y divide-zinc-800/50">
              {exercises.map((e) => (
                <div
                  key={e.id}
                  onClick={() => handleAddExerciseToWorkout(e)}
                  className="py-3 px-2 flex justify-between items-center hover:bg-zinc-800 rounded cursor-pointer transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{e.name}</p>
                    <span className="text-xs text-zinc-500">
                      {e.targetMuscle} • {e.equipment}
                    </span>
                  </div>
                  <Plus className="w-4 h-4 text-zinc-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {restTimerEnabled && (
        <RestTimerModal
          secondsRemaining={secondsRemaining}
          isRunning={isRunning}
          onPause={pauseTimer}
          onResume={resumeTimer}
          onSkip={skipTimer}
          onAdd30={addThirtySeconds}
        />
      )}
    </div>
  );
}
