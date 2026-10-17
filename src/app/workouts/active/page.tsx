// src/app/workouts/active/page.tsx
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { WorkoutExercise, WorkoutSet, Exercise, Workout, RoutineItem, BodyWeight } from "@/types";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  CheckCheck,
  Trash2,
  ArrowLeft,
  Calendar,
  BookmarkPlus,
  RefreshCw,
  Scale,
  ChevronUp,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import SetRow from "@/components/SetRow";
import RestTimerModal from "@/components/RestTimerModal";
import ExerciseSelectorModal from "@/components/ExerciseSelectorModal";
import { useRestTimer } from "@/hooks/useRestTimer";
import { calculateWorkoutVolume } from "@/lib/formulas";
import { pushLatestToDrive, triggerAutoSync } from "@/lib/driveSync";

export default function ActiveWorkoutView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryWorkoutId = searchParams.get("workoutId");
  const fromSource = searchParams.get("from");

  // Load target workout: either specific history ID or first active incomplete workout
  const workout = useLiveQuery<Workout | undefined>(
    () =>
      queryWorkoutId
        ? db.workouts.get(queryWorkoutId)
        : db.workouts.filter((w) => !w.isCompleted).first(),
    [queryWorkoutId]
  );

  const isEditingPastSession = Boolean(workout?.isCompleted);

  const workoutExercises = useLiveQuery<WorkoutExercise[]>(
    () =>
      workout
        ? db.workoutExercises
            .where("workoutId")
            .equals(workout.id)
            .sortBy("orderIndex")
        : Promise.resolve([]),
    [workout?.id]
  ) || [];

  const sets = useLiveQuery<WorkoutSet[]>(
    () =>
      workout
        ? db.sets.where("workoutId").equals(workout.id).toArray()
        : Promise.resolve([]),
    [workout?.id]
  ) || [];

  const exercises = useLiveQuery<Exercise[]>(() => db.exercises.toArray(), []) || [];
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  const latestRecordedWeight = useLiveQuery<BodyWeight | undefined>(
    () => db.bodyWeights.orderBy("recordedAt").reverse().first(),
    []
  );

  const [sessionBodyWeight, setSessionBodyWeight] = useState<string>("");
  const [hasEnteredWeight, setHasEnteredWeight] = useState(false);

  // Custom UI Dialog replacing browser alert/confirm
  const [showTemplateSyncDialog, setShowTemplateSyncDialog] = useState(false);
  const [showDiscardConfirmDialog, setShowDiscardConfirmDialog] = useState(false);

  useEffect(() => {
    if (latestRecordedWeight && !hasEnteredWeight) {
      setSessionBodyWeight(String(latestRecordedWeight.weightKg));
    }
  }, [latestRecordedWeight, hasEnteredWeight]);

  const previousPerformanceMap = useLiveQuery(async () => {
    const map = new Map<string, WorkoutSet[]>();
    const completedWorkouts = await db.workouts
      .filter((w) => Boolean(w.isCompleted) && Boolean(w.endTime))
      .toArray();

    completedWorkouts.sort((a, b) => (b.endTime || 0) - (a.endTime || 0));

    for (const ex of exercises) {
      for (const cw of completedWorkouts) {
        if (cw.id === workout?.id) continue;
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
  }, [exercises, workout?.id]);

  const originalRoutineItems = useLiveQuery<RoutineItem[]>(async () => {
    if (!workout?.routineId) return [];
    return db.routineItems
      .where("routineId")
      .equals(workout.routineId)
      .sortBy("orderIndex");
  }, [workout?.routineId]) || [];

  const isRoutineModified = (() => {
    if (!workout?.routineId || originalRoutineItems.length === 0) return false;
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

  if (!workout) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-sm text-zinc-400">No workout session found.</p>
        <button
          onClick={() => router.push(fromSource === "history" ? "/workouts?tab=history" : "/")}
          className="bg-white text-black font-bold px-4 py-2 rounded-xl text-sm"
        >
          {fromSource === "history" ? "Back to History" : "Go to Dashboard"}
        </button>
      </div>
    );
  }

  const currentIsoDate = new Date(workout.startTime).toISOString().split("T")[0];

  const handleDateChange = async (dateStr: string) => {
    if (!dateStr) return;
    const [year, month, day] = dateStr.split("-").map(Number);
    const updatedDate = new Date(year, month - 1, day, 12, 0, 0);

    await db.workouts.update(workout.id, {
      startTime: updatedDate.getTime(),
    });
    triggerAutoSync();
  };

  const handleBackNavigation = () => {
    if (fromSource === "history") {
      router.push("/workouts?tab=history");
    } else {
      router.back();
    }
  };

  const handleDiscardConfirmed = async () => {
    await db.workouts.delete(workout.id);
    await db.workoutExercises.where("workoutId").equals(workout.id).delete();
    await db.sets.where("workoutId").equals(workout.id).delete();
    triggerAutoSync();
    handleBackNavigation();
  };

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

  const finalizeFinish = async (updateTemplate: boolean) => {
    if (updateTemplate && workout.routineId) {
      await syncWorkoutToRoutineTemplate(workout.routineId);
    }

    const parsedWeight = parseFloat(sessionBodyWeight);
    if (!isNaN(parsedWeight) && parsedWeight > 0) {
      await db.bodyWeights.add({
        id: `bw_${Date.now()}`,
        recordedAt: Date.now(),
        weightKg: parsedWeight,
      });
    }

    const totalVolume = calculateWorkoutVolume(sets);
    const baseDate = new Date(workout.startTime);
    const finishTimestamp =
      workout.endTime ||
      new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate(),
        new Date().getHours(),
        new Date().getMinutes()
      ).getTime();

    await db.workouts.update(workout.id, {
      endTime: finishTimestamp,
      totalVolumeKg: totalVolume,
      isCompleted: true,
    });

    pushLatestToDrive().catch(() => {});
    setShowTemplateSyncDialog(false);

    if (fromSource === "history") {
      router.push("/workouts?tab=history");
    } else {
      router.push("/workouts");
    }
  };

  const handleInitiateFinish = () => {
    if (!isEditingPastSession && workout.routineId && isRoutineModified) {
      setShowTemplateSyncDialog(true);
    } else {
      finalizeFinish(false);
    }
  };

  const handleMoveExercise = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= workoutExercises.length) return;

    const current = workoutExercises[index];
    const target = workoutExercises[targetIndex];

    await db.workoutExercises.update(current.id, { orderIndex: targetIndex + 1 });
    await db.workoutExercises.update(target.id, { orderIndex: index + 1 });
    triggerAutoSync();
  };

  const handleDeleteSet = async (setId: string, workoutExerciseId: string) => {
    await db.sets.delete(setId);
    const remainingSets = await db.sets
      .where("workoutExerciseId")
      .equals(workoutExerciseId)
      .sortBy("setIndex");

    for (let i = 0; i < remainingSets.length; i++) {
      await db.sets.update(remainingSets[i].id, { setIndex: i + 1 });
    }
    triggerAutoSync();
  };

  const handleAddSet = async (we: WorkoutExercise) => {
    const targetSets = sets.filter((s) => s.workoutExerciseId === we.id);
    const lastSet = targetSets[targetSets.length - 1];

    await db.sets.add({
      id: `s_${Date.now()}_${targetSets.length + 1}`,
      workoutExerciseId: we.id,
      workoutId: workout.id,
      exerciseId: we.exerciseId,
      setIndex: targetSets.length + 1,
      setType: "normal",
      weightKg: lastSet ? lastSet.weightKg : 0,
      reps: lastSet ? lastSet.reps : 10,
      isCompleted: isEditingPastSession ? true : false,
    });

    triggerAutoSync();
  };

  const handleAddSingleExercise = async (exerciseId: string) => {
    const prevSets = previousPerformanceMap?.get(exerciseId) || [];
    const prefillWeight = prevSets[0]?.weightKg || 0;
    const prefillReps = prevSets[0]?.reps || 10;

    const weId = `we_${Date.now()}_${exerciseId}`;
    await db.workoutExercises.add({
      id: weId,
      workoutId: workout.id,
      exerciseId: exerciseId,
      orderIndex: workoutExercises.length + 1,
    });

    await db.sets.add({
      id: `s_${Date.now()}_1`,
      workoutExerciseId: weId,
      workoutId: workout.id,
      exerciseId: exerciseId,
      setIndex: 1,
      setType: "normal",
      weightKg: prefillWeight,
      reps: prefillReps,
      isCompleted: isEditingPastSession ? true : false,
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
        workoutId: workout.id,
        exerciseId: id,
        orderIndex: workoutExercises.length + 1,
      });

      await db.sets.add({
        id: `s_${Date.now()}_${id}_1`,
        workoutExerciseId: weId,
        workoutId: workout.id,
        exerciseId: id,
        setIndex: 1,
        setType: "normal",
        weightKg: prefillWeight,
        reps: prefillReps,
        isCompleted: isEditingPastSession ? true : false,
      });
    }

    setShowExerciseSelector(false);
    triggerAutoSync();
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Session Top Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <button onClick={handleBackNavigation} className="text-zinc-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 mx-3">
          <input
            type="text"
            value={workout.title}
            onChange={(e) => {
              db.workouts.update(workout.id, { title: e.target.value });
            }}
            placeholder="Workout Title"
            className="w-full bg-transparent font-bold text-sm text-white outline-none border-b border-transparent focus:border-zinc-500 pb-0.5"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowDiscardConfirmDialog(true)}
            title="Delete Session"
            className="bg-zinc-900 border border-zinc-800 hover:border-rose-900 hover:text-rose-400 text-zinc-400 font-semibold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleInitiateFinish}
            className="bg-white text-black hover:bg-zinc-200 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all"
          >
            <CheckCheck className="w-4 h-4" /> {isEditingPastSession ? "Save" : "Finish"}
          </button>
        </div>
      </div>

      {/* Date Picker, Body Weight */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-xs text-zinc-300">
          <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="date"
            value={currentIsoDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1 outline-none font-mono w-full"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-xs text-zinc-300">
          <Scale className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="number"
            step="0.1"
            placeholder={latestRecordedWeight ? `${latestRecordedWeight.weightKg}` : "Weight"}
            value={sessionBodyWeight}
            onChange={(e) => {
              setHasEnteredWeight(true);
              setSessionBodyWeight(e.target.value);
            }}
            className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1 outline-none font-mono w-full"
          />
          <span className="text-[10px] text-zinc-500 font-semibold">kg</span>
        </div>
      </div>

      {/* Exercises List */}
      <div className="space-y-4">
        {workoutExercises.map((we, exIdx) => {
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
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={exIdx === 0}
                      onClick={() => handleMoveExercise(exIdx, "up")}
                      className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 rounded"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={exIdx === workoutExercises.length - 1}
                      onClick={() => handleMoveExercise(exIdx, "down")}
                      className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 rounded"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">
                      {exercise?.name || "Exercise"}
                    </h3>
                    <span className="text-[10px] text-zinc-500">
                      {exercise?.targetMuscle} • {exercise?.equipment}
                    </span>
                  </div>
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
                      onDelete={() => handleDeleteSet(s.id, we.id)}
                      onToggleComplete={async () => {
                        const updatedStatus = !s.isCompleted;
                        await db.sets.update(s.id, {
                          isCompleted: updatedStatus,
                          completedAt: updatedStatus ? Date.now() : undefined,
                        });

                        const timerPref = localStorage.getItem("repwise_rest_timer_enabled");
                        const isTimerEnabled = timerPref === null ? true : timerPref === "true";

                        if (updatedStatus && isTimerEnabled && !isEditingPastSession) {
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

      <button
        onClick={() => setShowExerciseSelector(true)}
        className="w-full py-3 border border-dashed border-zinc-800 hover:border-zinc-500 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Add Exercise
      </button>

      {/* Discard Session In-App Dialog */}
      {showDiscardConfirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-3">
            <h3 className="font-bold text-white text-sm">
              {isEditingPastSession ? "Delete Workout History?" : "Discard Active Workout?"}
            </h3>
            <p className="text-xs text-zinc-400">
              {isEditingPastSession
                ? "This workout session will be completely deleted from your history."
                : "All sets logged in this session will be permanently erased."}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDiscardConfirmDialog(false)}
                className="flex-1 py-2.5 bg-zinc-800 text-xs font-semibold text-zinc-300 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDiscardConfirmed}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Template Sync Confirmation Sheet (Solves Point 4) */}
      {showTemplateSyncDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-2xl p-5 mb-16 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <h3 className="font-bold text-white text-sm">Save Routine Changes?</h3>
            </div>
            <p className="text-xs text-zinc-300">
              You added or removed exercises from this planned routine. Would you like to update your saved routine template for next time?
            </p>
            <div className="space-y-2 pt-1">
              <button
                onClick={() => finalizeFinish(true)}
                className="w-full py-2.5 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs transition-colors"
              >
                Update Routine & Finish
              </button>
              <button
                onClick={() => finalizeFinish(false)}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-xl text-xs transition-colors"
              >
                Finish Workout Only
              </button>
            </div>
          </div>
        </div>
      )}

      <ExerciseSelectorModal
        isOpen={showExerciseSelector}
        onClose={() => setShowExerciseSelector(false)}
        exercises={exercises}
        onSelectSingle={handleAddSingleExercise}
        onSelectMultiple={handleAddMultipleExercises}
      />

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