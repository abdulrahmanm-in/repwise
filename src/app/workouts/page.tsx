// src/app/workouts/page.tsx
"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { Routine, Exercise, MuscleGroup, WorkoutSet } from "@/types";
import {
  Play,
  Plus,
  BookOpen,
  History,
  Trash2,
  X,
  Dumbbell,
  Search,
  Pencil,
  Library,
  Sparkles,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import CreateExerciseModal from "@/components/CreateExerciseModal";
import ImportAIRoutineModal from "@/components/ImportAIRoutineModal";
import ExerciseSelectorModal from "@/components/ExerciseSelectorModal";

interface PlannedItem {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
}

const MUSCLE_GROUPS: (MuscleGroup | "All" | "Custom")[] = [
  "All",
  "Custom",
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
];

export default function WorkoutsTab() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"routines" | "exercises" | "history">("routines");

  // Routine Modal State
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineTitle, setRoutineTitle] = useState("");
  const [plannedItems, setPlannedItems] = useState<PlannedItem[]>([]);

  // Exercise Picker Modal State
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  // Standalone Exercise Library Tab State
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryMuscle, setLibraryMuscle] = useState<MuscleGroup | "All" | "Custom">("All");
  const [showCreateExerciseModal, setShowCreateExerciseModal] = useState(false);

  // AI Import Routine Modal State
  const [showAIModal, setShowAIModal] = useState(false);

  // Active Workout Conflict State
  const [pendingRoutineToStart, setPendingRoutineToStart] = useState<Routine | null>(null);
  const [showActiveConflictModal, setShowActiveConflictModal] = useState(false);

  const routines = useLiveQuery(() => db.routines.toArray(), []) || [];
  const history =
    useLiveQuery(
      () => db.workouts.where("isCompleted").equals(1).reverse().sortBy("endTime"),
      []
    ) || [];

  const exercises = useLiveQuery<Exercise[]>(() => db.exercises.toArray(), []) || [];
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  const customExercisesCount = exercises.filter((e) => Boolean(e.isCustom)).length;
  const isRoutineLimitReached = routines.length >= 10;
  const isCustomExerciseLimitReached = customExercisesCount >= 20;

  const handleOpenCreateRoutine = () => {
    if (isRoutineLimitReached) {
      alert("Routine limit reached (maximum 10 routines). Please delete an existing routine to plan a new one.");
      return;
    }
    setEditingRoutineId(null);
    setRoutineTitle("");
    setPlannedItems([]);
    setIsRoutineModalOpen(true);
  };

  const handleOpenEditRoutine = async (routine: Routine) => {
    const existingItems = await db.routineItems
      .where("routineId")
      .equals(routine.id)
      .sortBy("orderIndex");

    setEditingRoutineId(routine.id);
    setRoutineTitle(routine.title);
    setPlannedItems(
      existingItems.map((item) => ({
        exerciseId: item.exerciseId,
        targetSets: item.targetSets || 3,
        targetReps: item.targetReps || 10,
      }))
    );
    setIsRoutineModalOpen(true);
  };

  const handleMoveExercise = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= plannedItems.length) return;

    const updated = [...plannedItems];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setPlannedItems(updated);
  };

  const handleSaveRoutine = async () => {
    const trimmedTitle = routineTitle.trim();
    if (!trimmedTitle) {
      alert("Please provide a routine name.");
      return;
    }
    if (plannedItems.length === 0) {
      alert("Please add at least one exercise to the routine.");
      return;
    }

    const isDuplicate = routines.some(
      (r) =>
        r.id !== editingRoutineId &&
        r.title.trim().toLowerCase() === trimmedTitle.toLowerCase()
    );

    if (isDuplicate) {
      alert(`A routine named "${trimmedTitle}" already exists. Please choose a unique name.`);
      return;
    }

    if (editingRoutineId) {
      await db.routines.update(editingRoutineId, {
        title: trimmedTitle,
        updatedAt: Date.now(),
      });
      await db.routineItems.where("routineId").equals(editingRoutineId).delete();
      for (let i = 0; i < plannedItems.length; i++) {
        const item = plannedItems[i];
        await db.routineItems.add({
          id: `ri_${Date.now()}_${i}`,
          routineId: editingRoutineId,
          exerciseId: item.exerciseId,
          orderIndex: i + 1,
          targetSets: item.targetSets,
          targetReps: item.targetReps,
          restSeconds: 90,
        });
      }
    } else {
      if (isRoutineLimitReached) {
        alert("Maximum limit of 10 routines reached. Please delete an existing routine first.");
        return;
      }

      const newRoutineId = `rt_${Date.now()}`;
      await db.routines.add({
        id: newRoutineId,
        title: trimmedTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      for (let i = 0; i < plannedItems.length; i++) {
        const item = plannedItems[i];
        await db.routineItems.add({
          id: `ri_${Date.now()}_${i}`,
          routineId: newRoutineId,
          exerciseId: item.exerciseId,
          orderIndex: i + 1,
          targetSets: item.targetSets,
          targetReps: item.targetReps,
          restSeconds: 90,
        });
      }
    }

    setIsRoutineModalOpen(false);
    setEditingRoutineId(null);
    setRoutineTitle("");
    setPlannedItems([]);
  };

  const initiateRoutineStart = async (routine: Routine) => {
    const unfinished = await db.workouts.filter((w) => !w.isCompleted).toArray();
    if (unfinished.length > 0) {
      setPendingRoutineToStart(routine);
      setShowActiveConflictModal(true);
      return;
    }

    await executeStartRoutine(routine);
  };

  const executeStartRoutine = async (routine: Routine) => {
    const unfinished = await db.workouts.filter((w) => !w.isCompleted).toArray();
    for (const w of unfinished) {
      await db.workouts.delete(w.id);
      await db.workoutExercises.where("workoutId").equals(w.id).delete();
      await db.sets.where("workoutId").equals(w.id).delete();
    }

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

    const completedWorkouts = await db.workouts
      .filter((w) => Boolean(w.isCompleted) && Boolean(w.endTime))
      .toArray();
    completedWorkouts.sort((a, b) => (b.endTime || 0) - (a.endTime || 0));

    for (const item of routineItems) {
      const weId = `we_${Date.now()}_${item.exerciseId}`;
      await db.workoutExercises.add({
        id: weId,
        workoutId,
        exerciseId: item.exerciseId,
        orderIndex: item.orderIndex,
      });

      let previousSets: WorkoutSet[] = [];
      for (const cw of completedWorkouts) {
        const found = await db.sets
          .where("workoutId")
          .equals(cw.id)
          .filter((s) => s.exerciseId === item.exerciseId && Boolean(s.isCompleted))
          .sortBy("setIndex");
        if (found.length > 0) {
          previousSets = found;
          break;
        }
      }

      const setsCount = item.targetSets || 3;
      for (let s = 1; s <= setsCount; s++) {
        const ghostSet = previousSets[s - 1] || previousSets[0];
        const initialWeight = ghostSet ? ghostSet.weightKg : item.targetWeightKg || 0;
        const initialReps = ghostSet ? ghostSet.reps : item.targetReps || 10;

        await db.sets.add({
          id: `s_${Date.now()}_${item.exerciseId}_${s}`,
          workoutExerciseId: weId,
          workoutId,
          exerciseId: item.exerciseId,
          setIndex: s,
          setType: "normal",
          weightKg: initialWeight,
          reps: initialReps,
          isCompleted: false,
        });
      }
    }

    router.push("/workouts/active");
  };

  const filteredLibrary = exercises.filter((e) => {
    const matchSearch =
      e.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
      e.equipment.toLowerCase().includes(librarySearch.toLowerCase());
    const matchMuscle =
      libraryMuscle === "All"
        ? true
        : libraryMuscle === "Custom"
        ? Boolean(e.isCustom)
        : e.targetMuscle === libraryMuscle;
    return matchSearch && matchMuscle;
  });

  return (
    <div className="space-y-4 pb-24">
      {/* 3-Way Top Navigation Bar */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("routines")}
          className={clsx(
            "flex-1 pb-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all",
            activeTab === "routines"
              ? "border-white text-white font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <BookOpen className="w-3.5 h-3.5" /> Routines
        </button>
        <button
          onClick={() => setActiveTab("exercises")}
          className={clsx(
            "flex-1 pb-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all",
            activeTab === "exercises"
              ? "border-white text-white font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Library className="w-3.5 h-3.5" /> Library
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={clsx(
            "flex-1 pb-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all",
            activeTab === "history"
              ? "border-white text-white font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <History className="w-3.5 h-3.5" /> History
        </button>
      </div>

      {/* TAB 1: ROUTINES */}
      {activeTab === "routines" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center py-1">
            <span className="text-xs uppercase text-zinc-400 font-semibold tracking-wider">
              Routines ({routines.length}/10)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (isRoutineLimitReached) {
                    alert("Routine limit reached (10/10). Please delete an existing routine to import more.");
                    return;
                  }
                  setShowAIModal(true);
                }}
                className={clsx(
                  "text-xs border font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all active:scale-95",
                  isRoutineLimitReached
                    ? "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-white"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" /> AI Import
              </button>
              <button
                onClick={handleOpenCreateRoutine}
                className={clsx(
                  "text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all active:scale-95",
                  isRoutineLimitReached
                    ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    : "bg-white text-black hover:bg-zinc-200"
                )}
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" /> Plan Routine
              </button>
            </div>
          </div>

          {routines.length === 0 ? (
            <div className="p-8 text-center border border-zinc-800 rounded-xl space-y-2">
              <Dumbbell className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-xs text-zinc-400">No workout routines created yet.</p>
            </div>
          ) : (
            routines.map((routine) => (
              <div
                key={routine.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between hover:border-zinc-700 transition-colors"
              >
                <div
                  onClick={() => handleOpenEditRoutine(routine)}
                  className="flex-1 cursor-pointer pr-3"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white text-sm hover:underline">
                      {routine.title}
                    </h3>
                    <Pencil className="w-3 h-3 text-zinc-500" />
                  </div>
                  <span className="text-xs text-zinc-500">Tap to edit template</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Delete routine "${routine.title}"?`)) {
                        await db.routines.delete(routine.id);
                        await db.routineItems.where("routineId").equals(routine.id).delete();
                      }
                    }}
                    className="p-2 text-zinc-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      initiateRoutineStart(routine);
                    }}
                    className="bg-white text-black hover:bg-zinc-200 px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Start
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: EXERCISE LIBRARY */}
      {activeTab === "exercises" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase text-zinc-400 font-semibold tracking-wider">
              {libraryMuscle === "Custom"
                ? `Custom Exercises (${customExercisesCount}/20)`
                : `Exercise Catalog (${filteredLibrary.length})`}
            </span>
            <button
              onClick={() => {
                if (isCustomExerciseLimitReached) {
                  alert("Custom exercise limit reached (20/20). Please delete an existing custom exercise to add more.");
                  return;
                }
                setShowCreateExerciseModal(true);
              }}
              className={clsx(
                "text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all active:scale-95",
                isCustomExerciseLimitReached
                  ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  : "bg-white text-black hover:bg-zinc-200"
              )}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add Custom
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search exercise or equipment..."
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-500 rounded-xl pl-8 pr-3 py-2 text-xs text-white outline-none"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {MUSCLE_GROUPS.map((m) => (
              <button
                key={m}
                onClick={() => setLibraryMuscle(m)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                  libraryMuscle === m
                    ? "bg-white text-black font-bold"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                )}
              >
                {m === "Custom" ? `Custom (${customExercisesCount}/20)` : m}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredLibrary.map((ex) => (
              <div
                key={ex.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex justify-between items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{ex.name}</p>
                    {ex.isCustom && (
                      <span className="text-[9px] uppercase px-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 font-semibold">
                        Custom
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">
                    {ex.targetMuscle} • {ex.equipment}
                  </span>
                </div>

                {ex.isCustom && (
                  <button
                    onClick={async () => {
                      if (confirm(`Delete custom exercise "${ex.name}"?`)) {
                        await db.exercises.delete(ex.id);
                      }
                    }}
                    className="p-1.5 text-zinc-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 border border-zinc-800 rounded-xl">
              No historical workouts logged yet.
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex justify-between items-center"
              >
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
                  <span className="text-xs font-mono font-bold text-white">
                    {Math.round(item.totalVolumeKg)} kg
                  </span>
                  <span className="block text-[10px] text-zinc-500 uppercase">Volume</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Routine Planner / Editor Modal */}
      {isRoutineModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pb-20 select-none">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 w-full max-w-md h-[82vh] max-h-[640px] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800 shrink-0">
              <h2 className="text-base font-bold text-white">
                {editingRoutineId ? "Edit Routine Template" : "New Routine Template"}
              </h2>
              <button
                onClick={() => setIsRoutineModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 py-4 flex-1 pr-1">
              <div>
                <label className="block text-xs uppercase font-semibold text-zinc-400 mb-1">
                  Routine Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pull Day"
                  value={routineTitle}
                  onChange={(e) => setRoutineTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-white rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div className="space-y-3">
                <span className="text-xs uppercase font-semibold text-zinc-400 block">
                  Exercises ({plannedItems.length})
                </span>

                {plannedItems.map((item, idx) => {
                  const ex = exerciseMap.get(item.exerciseId);
                  return (
                    <div
                      key={`${item.exerciseId}_${idx}`}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-2.5"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-0.5 mr-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveExercise(idx, "up")}
                              className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 disabled:hover:text-zinc-500 rounded hover:bg-zinc-800 transition-colors"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === plannedItems.length - 1}
                              onClick={() => handleMoveExercise(idx, "down")}
                              className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 disabled:hover:text-zinc-500 rounded hover:bg-zinc-800 transition-colors"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="text-sm font-semibold text-white">
                            {ex?.name || "Exercise"}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            setPlannedItems(plannedItems.filter((_, i) => i !== idx));
                          }}
                          className="text-zinc-600 hover:text-rose-400 p-1 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        <div>
                          <label className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1">
                            Sets
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="15"
                            value={item.targetSets}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              const updated = [...plannedItems];
                              updated[idx].targetSets = val;
                              setPlannedItems(updated);
                            }}
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-2 text-white font-mono outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1">
                            Target Reps
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={item.targetReps}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              const updated = [...plannedItems];
                              updated[idx].targetReps = val;
                              setPlannedItems(updated);
                            }}
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-2 text-white font-mono outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setShowExercisePicker(true)}
                  className="w-full py-3 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Exercise to Routine
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 shrink-0">
              <button
                onClick={handleSaveRoutine}
                className="w-full py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-sm transition-all shadow-md active:scale-95"
              >
                {editingRoutineId ? "Update Routine" : "Save Routine"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Unified Exercise Selector Modal */}
      <ExerciseSelectorModal
        isOpen={showExercisePicker}
        onClose={() => setShowExercisePicker(false)}
        exercises={exercises}
        onSelectSingle={(id) => {
          setPlannedItems([...plannedItems, { exerciseId: id, targetSets: 3, targetReps: 10 }]);
        }}
        onSelectMultiple={(ids) => {
          const newEntries = ids.map((id) => ({
            exerciseId: id,
            targetSets: 3,
            targetReps: 10,
          }));
          setPlannedItems([...plannedItems, ...newEntries]);
        }}
      />

      {/* Active Workout Conflict Modal */}
      {showActiveConflictModal && (
        <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Active Session In Progress</h3>
                <p className="text-xs text-zinc-400">You already have an unfinished workout.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300">
              Starting a new routine will discard your current active workout session. Would you like to resume it instead?
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setShowActiveConflictModal(false);
                  router.push("/workouts/active");
                }}
                className="w-full py-2.5 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs transition-all shadow-sm"
              >
                Resume Current Workout
              </button>
              <button
                onClick={async () => {
                  setShowActiveConflictModal(false);
                  if (pendingRoutineToStart) {
                    await executeStartRoutine(pendingRoutineToStart);
                    setPendingRoutineToStart(null);
                  }
                }}
                className="w-full py-2.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-bold rounded-xl text-xs transition-all"
              >
                Discard & Start New Routine
              </button>
              <button
                onClick={() => {
                  setShowActiveConflictModal(false);
                  setPendingRoutineToStart(null);
                }}
                className="w-full py-2 bg-transparent text-zinc-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Creating Custom Exercise */}
      <CreateExerciseModal
        isOpen={showCreateExerciseModal}
        onClose={() => setShowCreateExerciseModal(false)}
      />

      {/* Modal for Guided AI Routine Import */}
      <ImportAIRoutineModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onImportComplete={() => {}}
        existingExercises={exercises}
      />
    </div>
  );
}