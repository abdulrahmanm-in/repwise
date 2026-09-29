// src/components/ExerciseSelectorModal.tsx
"use client";

import { useState } from "react";
import { Exercise, MuscleGroup } from "@/types";
import { Search, Check, Plus, Dumbbell } from "lucide-react";
import clsx from "clsx";
import CreateExerciseModal from "@/components/CreateExerciseModal";

const MUSCLE_GROUPS: (MuscleGroup | "All")[] = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
];

interface ExerciseSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onSelectSingle: (exerciseId: string) => void;
  onSelectMultiple: (exerciseIds: string[]) => void;
  title?: string;
}

export default function ExerciseSelectorModal({
  isOpen,
  onClose,
  exercises,
  onSelectSingle,
  onSelectMultiple,
  title = "Add Exercises",
}: ExerciseSelectorModalProps) {
  const [search, setSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | "All">("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (!isOpen) return null;

  const filteredExercises = exercises.filter((e) => {
    const matchSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.equipment.toLowerCase().includes(search.toLowerCase());
    const matchMuscle = selectedMuscle === "All" || e.targetMuscle === selectedMuscle;
    return matchSearch && matchMuscle;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmMultiple = () => {
    if (selectedIds.length === 0) return;
    onSelectMultiple(selectedIds);
    setSelectedIds([]);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 select-none">
        <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-4 w-full sm:max-w-lg h-[88vh] flex flex-col relative pb-20 sm:pb-4">
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b border-zinc-800 shrink-0">
            <h2 className="font-bold text-sm text-white">{title}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Custom</span>
              </button>
              <button
                onClick={() => {
                  setSelectedIds([]);
                  onClose();
                }}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1"
              >
                Close
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="pt-3 pb-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search exercises or equipment..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-xl pl-8 pr-3 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>

          {/* Muscle Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar shrink-0">
            {MUSCLE_GROUPS.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMuscle(m)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                  selectedMuscle === m
                    ? "bg-white text-black font-bold"
                    : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white"
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Exercise Items List */}
          <div className="overflow-y-auto py-1 space-y-2 flex-1 pr-1 pb-16">
            {filteredExercises.length === 0 ? (
              <div className="p-8 text-center border border-zinc-800/60 rounded-xl my-4 space-y-2">
                <Dumbbell className="w-7 h-7 mx-auto text-zinc-600" />
                <p className="text-xs text-zinc-400">No matching exercises found.</p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="text-xs text-white underline underline-offset-4 hover:text-zinc-300"
                >
                  Create custom exercise
                </button>
              </div>
            ) : (
              filteredExercises.map((e) => {
                const isSelected = selectedIds.includes(e.id);
                return (
                  <div
                    key={e.id}
                    onClick={() => toggleSelect(e.id)}
                    className={clsx(
                      "border rounded-xl p-3 flex justify-between items-center cursor-pointer transition-colors",
                      isSelected
                        ? "border-white bg-zinc-800/80"
                        : "bg-zinc-950 border-zinc-800/90 hover:border-zinc-700"
                    )}
                  >
                    {/* Left: Checkbox + Name */}
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          "w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0",
                          isSelected
                            ? "bg-white border-white text-black"
                            : "border-zinc-700 bg-zinc-900"
                        )}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{e.name}</p>
                          {e.isCustom && (
                            <span className="text-[9px] uppercase px-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 font-semibold">
                              Custom
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-zinc-400">
                          {e.targetMuscle} • {e.equipment}
                        </span>
                      </div>
                    </div>

                    {/* Right: Quick Add Button */}
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelectSingle(e.id);
                        onClose();
                      }}
                      className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      title="Add Single"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Floating Multi-select Submit Bar */}
          {selectedIds.length > 0 && (
            <div className="absolute left-4 right-4 bottom-20 sm:bottom-4 p-2 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-2xl shadow-2xl">
              <button
                type="button"
                onClick={handleConfirmMultiple}
                className="w-full py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <span>Add Selected ({selectedIds.length}) Exercises</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sub-modal to create custom exercise directly */}
      <CreateExerciseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
}