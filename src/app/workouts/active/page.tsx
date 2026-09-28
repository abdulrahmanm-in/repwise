// src/app/workouts/active/page.tsx
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { WorkoutExercise, WorkoutSet, Exercise, Workout, RoutineItem, MuscleGroup } from "@/types";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  CheckCheck,
  Trash2,
  ArrowLeft,
  Calendar,
  BookmarkPlus,
  Search,
  Check,
  RefreshCw,
} from "lucide-react";
import SetRow from "@/components/SetRow";
import RestTimerModal from "@/components/RestTimerModal";
import { useRestTimer } from "@/hooks/useRestTimer";
import { calculateWorkoutVolume } from "@/lib/formulas";
import { pushLatestToDrive, triggerAutoSync } from "@/lib/driveSync";
import clsx from "clsx";

const MUSCLE_GROUPS: (MuscleGroup | "All")[] = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
];

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

    // Check if exercise count differs
    if (workoutExercises.length !== originalRoutineItems.length) return true;

    // Check if any exercise or set count differs
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
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | "All">("All");
  const [searchExercise, setSearchExercise] = useState("");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);

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
    // If routine was modified, prompt user whether to save changes to template
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

  const handleAddSingleExercise = async (exercise: Exercise) => {
    const prevSets = previousPerformanceMap?.get(exercise.id) || [];
    const prefillWeight = prevSets[0]?.weightKg || 0;
    const prefillReps = prevSets[0]?.reps || 10;

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
      weightKg: prefillWeight,
      reps: prefillReps,
      isCompleted: false,
    });

    setShowExerciseSelector(false);
    triggerAutoSync();
  };

  const handleAddMultipleExercises = async () => {
    for (const id of selectedExerciseIds) {
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

    setSelectedExerciseIds([]);
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

  const filteredPickerExercises = exercises.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchExercise.toLowerCase()) ||
      e.equipment.toLowerCase().includes(searchExercise.toLowerCase());
    const matchesMuscle =
      selectedMuscle === "All" || e.targetMuscle === selectedMuscle;
    return matchesSearch && matchesMuscle;
  });

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

        {/* Show 'Save as Routine' for freestyle, or 'Update Routine' ONLY if modified */}
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
        onClick={() => {
          setSelectedExerciseIds([]);
          setShowExerciseSelector(true);
        }}
        className="w-full py-3 border border-dashed border-zinc-800 hover:border-zinc-500 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Add Exercise
      </button>

      {/* Exercise Picker Modal */}
      {showExerciseSelector && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-2xl p-4 max-h-[85vh] flex flex-col pb-16">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
              <h2 className="font-semibold text-sm text-white">Add Exercises</h2>
              <button
                onClick={() => setShowExerciseSelector(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="pt-3 pb-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search exercise..."
                  value={searchExercise}
                  onChange={(e) => setSearchExercise(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-white rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none"
                />
              </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar">
              {MUSCLE_GROUPS.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMuscle(m)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                    selectedMuscle === m
                      ? "bg-white text-black font-bold"
                      : "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto py-1 divide-y divide-zinc-800/50 flex-1">
              {filteredPickerExercises.map((e) => {
                const isSelected = selectedExerciseIds.includes(e.id);
                return (
                  <div
                    key={e.id}
                    className="py-2 px-2 flex justify-between items-center hover:bg-zinc-800/60 rounded-lg transition-colors group"
                  >
                    <div
                      onClick={() => handleAddSingleExercise(e)}
                      className="flex-1 cursor-pointer pr-3"
                    >
                      <p className="text-sm font-medium text-white group-hover:underline">
                        {e.name}
                      </p>
                      <span className="text-xs text-zinc-500">
                        {e.targetMuscle} • {e.equipment}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddSingleExercise(e)}
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-300 hover:text-white"
                        title="Add individually"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      <div
                        onClick={() => {
                          if (isSelected) {
                            setSelectedExerciseIds(
                              selectedExerciseIds.filter((id) => id !== e.id)
                            );
                          } else {
                            setSelectedExerciseIds([...selectedExerciseIds, e.id]);
                          }
                        }}
                        className={clsx(
                          "w-6 h-6 rounded border flex items-center justify-center cursor-pointer transition-colors",
                          isSelected
                            ? "bg-white border-white text-black"
                            : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
                        )}
                        title="Select for bulk add"
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedExerciseIds.length > 0 && (
              <div className="pt-3 border-t border-zinc-800">
                <button
                  onClick={handleAddMultipleExercises}
                  className="w-full py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-sm transition-all"
                >
                  Add Selected ({selectedExerciseIds.length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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