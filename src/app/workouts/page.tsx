// src/app/workouts/page.tsx
"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { Routine, Exercise, MuscleGroup } from "@/types";
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
} from "lucide-react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import CreateExerciseModal from "@/components/CreateExerciseModal";

interface PlannedItem {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
}

const MUSCLE_GROUPS: (MuscleGroup | "All")[] = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
];

export default function WorkoutsTab() {
  const router = useRouter();
  // Tab switcher now includes 'exercises'
  const [activeTab, setActiveTab] = useState<"routines" | "exercises" | "history">("routines");

  // Routine Modal State
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineTitle, setRoutineTitle] = useState("");
  const [plannedItems, setPlannedItems] = useState<PlannedItem[]>([]);

  // Exercise Picker inside Routine Modal
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchPicker, setSearchPicker] = useState("");

  // Standalone Exercise Library Tab State
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryMuscle, setLibraryMuscle] = useState<MuscleGroup | "All">("All");
  const [showCreateExerciseModal, setShowCreateExerciseModal] = useState(false);

  const routines = useLiveQuery(() => db.routines.toArray(), []) || [];
  const history =
    useLiveQuery(
      () => db.workouts.where("isCompleted").equals(1).reverse().sortBy("endTime"),
      []
    ) || [];

  const exercises = useLiveQuery<Exercise[]>(() => db.exercises.toArray(), []) || [];
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  // Handlers for Routines
  const handleOpenCreateRoutine = () => {
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

  const handleSaveRoutine = async () => {
    if (!routineTitle.trim()) {
      alert("Please provide a routine name.");
      return;
    }
    if (plannedItems.length === 0) {
      alert("Please add at least one exercise to the routine.");
      return;
    }

    if (editingRoutineId) {
      await db.routines.update(editingRoutineId, {
        title: routineTitle.trim(),
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
      const newRoutineId = `rt_${Date.now()}`;
      await db.routines.add({
        id: newRoutineId,
        title: routineTitle.trim(),
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

      const setsCount = item.targetSets || 3;
      for (let s = 1; s <= setsCount; s++) {
        await db.sets.add({
          id: `s_${Date.now()}_${item.exerciseId}_${s}`,
          workoutExerciseId: weId,
          workoutId,
          exerciseId: item.exerciseId,
          setIndex: s,
          setType: "normal",
          weightKg: item.targetWeightKg || 0,
          reps: item.targetReps || 10,
          isCompleted: false,
        });
      }
    }

    router.push("/workouts/active");
  };

  // Filtered Library Exercises
  const filteredLibrary = exercises.filter((e) => {
    const matchSearch =
      e.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
      e.equipment.toLowerCase().includes(librarySearch.toLowerCase());
    const matchMuscle = libraryMuscle === "All" || e.targetMuscle === libraryMuscle;
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
              Saved Templates ({routines.length})
            </span>
            <button
              onClick={handleOpenCreateRoutine}
              className="text-xs bg-white text-black hover:bg-zinc-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" /> Plan Routine
            </button>
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
                      handleStartRoutine(routine);
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
              Exercise Catalog ({filteredLibrary.length})
            </span>
            <button
              onClick={() => setShowCreateExerciseModal(true)}
              className="text-xs bg-white text-black hover:bg-zinc-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add Custom
            </button>
          </div>

          {/* Search Input */}
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

          {/* Muscle Group Horizontal Filter Pills */}
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
                {m}
              </button>
            ))}
          </div>

          {/* Exercise List */}
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
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
                  placeholder="e.g. Push Day"
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
                      className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-white">
                          {ex?.name || "Exercise"}
                        </span>
                        <button
                          onClick={() => {
                            setPlannedItems(plannedItems.filter((_, i) => i !== idx));
                          }}
                          className="text-zinc-600 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase block mb-1">
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
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white font-mono outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase block mb-1">
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
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white font-mono outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setShowExercisePicker(true)}
                  className="w-full py-2.5 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Exercise to Routine
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800">
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

      {/* Routine Planner Exercise Picker */}
      {showExercisePicker && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-2xl p-4 max-h-[85vh] flex flex-col pb-16">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
              <h2 className="font-semibold text-sm text-white">Select Exercise</h2>
              <button
                onClick={() => setShowExercisePicker(false)}
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
                  placeholder="Search exercises..."
                  value={searchPicker}
                  onChange={(e) => setSearchPicker(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-white rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none"
                />
              </div>
            </div>

            <div className="overflow-y-auto py-1 divide-y divide-zinc-800/50 flex-1">
              {exercises
                .filter((e) => e.name.toLowerCase().includes(searchPicker.toLowerCase()))
                .map((e) => (
                  <div
                    key={e.id}
                    onClick={() => {
                      setPlannedItems([
                        ...plannedItems,
                        { exerciseId: e.id, targetSets: 3, targetReps: 10 },
                      ]);
                      setShowExercisePicker(false);
                      setSearchPicker("");
                    }}
                    className="py-2.5 px-2 flex justify-between items-center hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors"
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

      {/* Modal for Creating Custom Exercise */}
      <CreateExerciseModal
        isOpen={showCreateExerciseModal}
        onClose={() => setShowCreateExerciseModal(false)}
      />
    </div>
  );
}