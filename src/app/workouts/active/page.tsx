// src/app/workouts/active/page.tsx
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { WorkoutExercise, WorkoutSet, Exercise, Workout, RoutineItem } from "@/types";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  CheckCheck,
  Trash2,
  ArrowLeft,
  Calendar,
  BookmarkPlus,
  RefreshCw,
} from "lucide-react";
import SetRow from "@/components/SetRow";
import RestTimerModal from "@/components/RestTimerModal";
import ExerciseSelectorModal from "@/components/ExerciseSelectorModal";
import { useRestTimer } from "@/hooks/useRestTimer";
import { calculateWorkoutVolume } from "@/lib/formulas";
import { pushLatestToDrive, triggerAutoSync } from "@/lib/driveSync";

export default function ActiveWorkoutView() {
  const router = useRouter();

  const activeWorkout = useLiveQuery<Workout | undefined>(
    () => db.workouts.filter((w) => !w.isCompleted).first(),
    []
  );

  const workoutExercises = useLiveQuery<WorkoutExercise[]>(
    () =>
      activeWorkout
        ? db.workoutExercises
            .where("workoutId")
            .equals(activeWorkout.id)
            .sortBy("orderIndex")
        : Promise.resolve([]),
    [activeWorkout]
  ) || [];

  const sets = useLiveQuery<WorkoutSet[]>(
    () =>
      activeWorkout
        ? db.sets.where("workoutId").equals(activeWorkout.id).toArray()
        : Promise.resolve([]),
    [activeWorkout]
  ) || [];

  const exercises = useLiveQuery<Exercise[]>(() => db.exercises.toArray(), []) || [];
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  // Ghost Values map
  const previousPerformanceMap = useLiveQuery(async () => {
    const map = new Map<string, WorkoutSet[]>();
    const completedWorkouts = await db.workouts
      .filter((w) => Boolean(w.isCompleted) && Boolean(w.endTime))
      .toArray();

    completedWorkouts.sort((a, b) => (b.endTime || 0) - (a.endTime || 0));

    for (const ex of exercises) {
      for (const cw of completedWorkouts) {
        const foundSets = await db.sets
          .where("workoutId")
          .equals(cw.id)
          .filter((s) => s.exerciseId === ex.id && Boolean(s.isCompleted))
          .sortBy("setIndex");

        if (foundSets.length > 0) {
          map.set(ex.id, foundSets);
          break;
        }
      }
    }
    return map;
  }, [exercises]);

  // Read original template items if this workout originated from a routine
  const originalRoutineItems = useLiveQuery<RoutineItem[]>(async () => {
    if (!activeWorkout?.routineId) return [];
    return db.routineItems
      .where("routineId")
      .equals(activeWorkout.routineId)
      .sortBy("orderIndex");
  }, [activeWorkout?.routineId]) || [];

  // Check if current workout differs from the saved routine template
  const isRoutineModified = (() => {
    if (!activeWorkout?.routineId || originalRoutineItems.length === 0) return false;

    if (workoutExercises.length !== originalRoutineItems.length) return true;

    for (let i = 0; i < workoutExercises.length; i++) {
      const we = workoutExercises[i];
      const orig = originalRoutineItems[i];
      if (!orig || we.exerciseId !== orig.exerciseId) return true;

      const currentExSets = sets.filter((s) => s.workoutExerciseId === we.id);
      if (currentExSets.length !== orig.targetSets) return true;
    }

    return false;
  })();

  const [showExerciseSelector, setShowExerciseSelector] = useState(false);

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
          onClick={() => router.push("/")}
          className="bg-white text-black font-bold px-4 py-2 rounded-xl text-sm"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const currentIsoDate = new Date(activeWorkout.startTime)
    .toISOString()
    .split("T")[0];

  const handleDateChange = async (dateStr: string) => {
    if (!dateStr) return;
    const [year, month, day] = dateStr.split("-").map(Number);
    const updatedDate = new Date(year, month - 1, day, 12, 0, 0);

    await db.workouts.update(activeWorkout.id, {
      startTime: updatedDate.getTime(),
    });
    triggerAutoSync();
  };

  const handleDiscardWorkout = async () => {
    const shouldDiscard = confirm(
      "Are you sure you want to discard this workout session? All logged data in this session will be deleted."
    );
    if (!shouldDiscard) return;

    await db.workouts.delete(activeWorkout.id);
    await db.workoutExercises
      .where("workoutId")
      .equals(activeWorkout.id)
      .delete();
    await db.sets.where("workoutId").equals(activeWorkout.id).delete();

    router.push("/");
  };

  // Sync current exercises back to the routine template
  const syncWorkoutToRoutineTemplate = async (routineId: string) => {
    await db.routineItems.where("routineId").equals(routineId).delete();

    for (let i = 0; i < workoutExercises.length; i++) {
      const we = workoutExercises[i];
      const exSets = sets.filter((s) => s.workoutExerciseId === we.id);
      const targetWeight = exSets[0]?.weightKg || 0;
      const targetReps = exSets[0]?.reps || 10;

      await db.routineItems.add({
        id: `ri_${Date.now()}_${i}`,
        routineId,
        exerciseId: we.exerciseId,
        orderIndex: i + 1,
        targetSets: Math.max(exSets.length, 1),
        targetReps,
        targetWeightKg: targetWeight,
        restSeconds: 90,
      });
    }
  };

  const handleFinishWorkout = async () => {
    if (activeWorkout.routineId && isRoutineModified) {
      const shouldUpdate = confirm(
        "You modified exercises or sets in this planned routine. Would you like to update the saved routine template as well?"
      );
      if (shouldUpdate) {
        await syncWorkoutToRoutineTemplate(activeWorkout.routineId);
      }
    }

    const totalVolume = calculateWorkoutVolume(sets);
    const baseDate = new Date(activeWorkout.startTime);
    const finishTimestamp = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      new Date().getHours(),
      new Date().getMinutes()
    ).getTime();

    await db.workouts.update(activeWorkout.id, {
      endTime: finishTimestamp,
      totalVolumeKg: totalVolume,
      isCompleted: true,
    });

    pushLatestToDrive().catch(() => {});
    router.push("/workouts");
  };

  const handleSaveAsRoutine = async () => {
    if (workoutExercises.length === 0) {
      alert("Add at least one exercise before saving as a routine.");
      return;
    }

    const title = prompt("Save as Routine Name:", activeWorkout.title);
    if (!title?.trim()) return;

    const newRoutineId = `rt_${Date.now()}`;
    await db.routines.add({
      id: newRoutineId,
      title: title.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await syncWorkoutToRoutineTemplate(newRoutineId);

    await db.workouts.update(activeWorkout.id, {
      routineId: newRoutineId,
    });

    alert(`Saved "${title.trim()}" to Routines!`);
    triggerAutoSync();
  };

  const handleAddSingleExercise = async (exerciseId: string) => {
    const prevSets = previousPerformanceMap?.get(exerciseId) || [];
    const prefillWeight = prevSets[0]?.weightKg || 0;
    const prefillReps = prevSets[0]?.reps || 10;

    const weId = `we_${Date.now()}_${exerciseId}`;
    await db.workoutExercises.add({
      id: weId,
      workoutId: activeWorkout.id,
      exerciseId: exerciseId,
      orderIndex: workoutExercises.length + 1,
    });

    await db.sets.add({
      id: `s_${Date.now()}_1`,
      workoutExerciseId: weId,
      workoutId: activeWorkout.id,
      exerciseId: exerciseId,
      setIndex: 1,
      setType: "normal",
      weightKg: prefillWeight,
      reps: prefillReps,
      isCompleted: false,
    });

    setShowExerciseSelector(false);
    triggerAutoSync();
  };

  const handleAddMultipleExercises = async (exerciseIds: string[]) => {
    for (const id of exerciseIds) {
      const prevSets = previousPerformanceMap?.get(id) || [];
      const prefillWeight = prevSets[0]?.weightKg || 0;
      const prefillReps = prevSets[0]?.reps || 10;

      const weId = `we_${Date.now()}_${id}`;
      await db.workoutExercises.add({
        id: weId,
        workoutId: activeWorkout.id,
        exerciseId: id,
        orderIndex: workoutExercises.length + 1,
      });

      await db.sets.add({
        id: `s_${Date.now()}_${id}_1`,
        workoutExerciseId: weId,
        workoutId: activeWorkout.id,
        exerciseId: id,
        setIndex: 1,
        setType: "normal",
        weightKg: prefillWeight,
        reps: prefillReps,
        isCompleted: false,
      });
    }

    setShowExerciseSelector(false);
    triggerAutoSync();
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

    triggerAutoSync();
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Session Top Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <button onClick={() => router.back()} className="text-zinc-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 mx-3">
          <input
            type="text"
            value={activeWorkout.title}
            onChange={(e) => {
              db.workouts.update(activeWorkout.id, { title: e.target.value });
            }}
            placeholder="Workout Title"
            className="w-full bg-transparent font-bold text-sm text-white outline-none border-b border-transparent focus:border-zinc-500 pb-0.5"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDiscardWorkout}
            title="Discard Session"
            className="bg-zinc-900 border border-zinc-800 hover:border-rose-900 hover:text-rose-400 text-zinc-400 font-semibold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFinishWorkout}
            className="bg-white text-black hover:bg-zinc-200 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all"
          >
            <CheckCheck className="w-4 h-4" /> Finish
          </button>
        </div>
      </div>

      {/* Date Picker & Context-Aware Actions */}
      <div className="flex justify-between items-center gap-2 bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="date"
            value={currentIsoDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1 outline-none font-mono"
          />
        </div>

        {!activeWorkout.routineId ? (
          <button
            onClick={handleSaveAsRoutine}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium transition-colors"
          >
            <BookmarkPlus className="w-3.5 h-3.5" /> Save as Routine
          </button>
        ) : isRoutineModified ? (
          <button
            onClick={async () => {
              await syncWorkoutToRoutineTemplate(activeWorkout.routineId!);
              alert("Routine template updated!");
              triggerAutoSync();
            }}
            className="text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Update Routine
          </button>
        ) : null}
      </div>

      {/* Exercises List */}
      <div className="space-y-4">
        {workoutExercises.map((we) => {
          const exercise = exerciseMap.get(we.exerciseId);
          const exerciseSets = sets
            .filter((s) => s.workoutExerciseId === we.id)
            .sort((a, b) => a.setIndex - b.setIndex);

          const prevSets = previousPerformanceMap?.get(we.exerciseId) || [];

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
                    triggerAutoSync();
                  }}
                  className="text-zinc-600 hover:text-rose-400 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Set Headers */}
              <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-semibold text-zinc-500 px-2">
                <span className="col-span-2 text-center">Set</span>
                <span className="col-span-3 text-center">Previous</span>
                <span className="col-span-3 text-center">Kg</span>
                <span className="col-span-2 text-center">Reps</span>
                <span className="col-span-2 text-right">Done</span>
              </div>

              {/* Set Rows */}
              <div className="space-y-1.5">
                {exerciseSets.map((s, idx) => {
                  const ghostSet = prevSets[idx];
                  return (
                    <SetRow
                      key={s.id}
                      set={s}
                      previousWeight={ghostSet?.weightKg}
                      previousReps={ghostSet?.reps}
                      onUpdate={async (fields) => {
                        await db.sets.update(s.id, fields);
                        triggerAutoSync();
                      }}
                      onToggleComplete={async () => {
                        const updatedStatus = !s.isCompleted;
                        await db.sets.update(s.id, {
                          isCompleted: updatedStatus,
                          completedAt: updatedStatus ? Date.now() : undefined,
                        });
                        if (updatedStatus) {
                          startTimer(90);
                        }
                        triggerAutoSync(500);
                      }}
                    />
                  );
                })}
              </div>

              <button
                onClick={() => handleAddSet(we)}
                className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Set
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Exercise Trigger Button */}
      <button
        onClick={() => setShowExerciseSelector(true)}
        className="w-full py-3 border border-dashed border-zinc-800 hover:border-zinc-500 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Add Exercise
      </button>

      {/* Shared Unified Exercise Selector Modal */}
      <ExerciseSelectorModal
        isOpen={showExerciseSelector}
        onClose={() => setShowExerciseSelector(false)}
        exercises={exercises}
        onSelectSingle={handleAddSingleExercise}
        onSelectMultiple={handleAddMultipleExercises}
      />

      {/* Floating Rest Timer */}
      <RestTimerModal
        secondsRemaining={secondsRemaining}
        isRunning={isRunning}
        onPause={pauseTimer}
        onResume={resumeTimer}
        onSkip={skipTimer}
        onAdd30={addThirtySeconds}
      />
    </div>
  );
}