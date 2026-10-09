// src/app/workouts/exercises/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { MuscleGroup, EquipmentType, Exercise } from "@/types";
import { ArrowLeft, Search, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { generateCanonicalKey } from "@/lib/exerciseKey";

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

export default function ExerciseLibraryPage() {
  const router = useRouter();
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | "All" | "Custom">("All");
  const [showAddModal, setShowAddModal] = useState(false);

  // New Exercise State
  const [name, setName] = useState("");
  const [targetMuscle, setTargetMuscle] = useState<MuscleGroup>("Chest");
  const [equipment, setEquipment] = useState<EquipmentType>("Barbell");
  const [instructions, setInstructions] = useState("");

  const exercises = useLiveQuery(() => db.exercises.toArray(), []) || [];
  const customExercisesCount = exercises.filter((e) => Boolean(e.isCustom)).length;
  const isCustomLimitReached = customExercisesCount >= 50;

  const filtered = exercises.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
      e.equipment.toLowerCase().includes(exerciseSearch.toLowerCase());
    const matchesMuscle =
      selectedMuscle === "All"
        ? true
        : selectedMuscle === "Custom"
        ? Boolean(e.isCustom)
        : e.targetMuscle === selectedMuscle;
    return matchesSearch && matchesMuscle;
  });

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (customExercisesCount >= 50) {
      alert("Custom exercise limit reached (maximum 50). Delete an existing custom exercise first.");
      return;
    }

    const targetKey = generateCanonicalKey(trimmedName, targetMuscle, equipment);
    const duplicate = exercises.find((e) => {
      const existingKey = generateCanonicalKey(e.name, e.targetMuscle, e.equipment);
      return existingKey === targetKey;
    });

    if (duplicate) {
      alert(`"${duplicate.name}" already exists in your library for ${equipment} (${targetMuscle}).`);
      return;
    }

    await db.exercises.add({
      id: `custom_${Date.now()}`,
      name: trimmedName,
      targetMuscle,
      equipment,
      instructions: instructions.trim() || undefined,
      isCustom: true,
      isArchived: false,
    });

    setName("");
    setInstructions("");
    setShowAddModal(false);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-white">Exercise Library</h1>
            <p className="text-[11px] text-zinc-400">Custom ({customExercisesCount}/50)</p>
          </div>
        </div>
        <button
          onClick={() => {
            if (isCustomLimitReached) {
              alert("Custom exercise limit reached (50/50). Delete an existing custom exercise to add more.");
              return;
            }
            setShowAddModal(true);
          }}
          className={clsx(
            "text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all active:scale-95",
            isCustomLimitReached
              ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              : "bg-white text-black hover:bg-zinc-200"
          )}
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add Custom
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Search by name or equipment..."
          value={exerciseSearch}
          onChange={(e) => setExerciseSearch(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-500 rounded-xl pl-8 pr-3 py-2 text-xs text-white outline-none"
        />
      </div>

      {/* Muscle Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {MUSCLE_GROUPS.map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMuscle(m)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
              selectedMuscle === m
                ? "bg-white text-black font-bold"
                : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
            )}
          >
            {m === "Custom" ? `Custom (${customExercisesCount}/50)` : m}
          </button>
        ))}
      </div>

      {/* Exercise List */}
      <div className="divide-y divide-zinc-800/60 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 max-h-[70vh] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            No matching exercises found.
          </div>
        ) : (
          filtered.map((e) => (
            <div
              key={e.id}
              className="py-3 px-2 flex justify-between items-center text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium">{e.name}</p>
                  {e.isCustom && (
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                      Custom
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400">
                  {e.targetMuscle} • {e.equipment}
                </span>
              </div>
              {e.isCustom && (
                <button
                  onClick={async () => {
                    if (confirm(`Delete "${e.name}"?`)) {
                      await db.exercises.delete(e.id);
                    }
                  }}
                  className="p-1.5 text-zinc-500 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Custom Exercise Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col justify-end p-0">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-2xl p-5 max-h-[85vh] flex flex-col space-y-4 pb-20 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h2 className="font-bold text-base text-white">Create Custom Exercise</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                Exercise Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Bulgarian Split Squat"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Target Muscle
                </label>
                <select
                  value={targetMuscle}
                  onChange={(e) => setTargetMuscle(e.target.value as MuscleGroup)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white outline-none"
                >
                  {["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Equipment
                </label>
                <select
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value as EquipmentType)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white outline-none"
                >
                  {["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight"].map(
                    (eq) => (
                      <option key={eq} value={eq}>
                        {eq}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                Instructions / Notes
              </label>
              <textarea
                placeholder="Grip width, bench angle, form cues..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white outline-none focus:border-white resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                disabled={!name.trim()}
                onClick={handleCreate}
                className="w-full py-3 bg-white text-black font-bold rounded-xl text-sm disabled:opacity-40"
              >
                Save Exercise
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}