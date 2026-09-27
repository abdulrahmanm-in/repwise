// src/components/CreateExerciseModal.tsx
"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { db } from "@/db/database";
import { MuscleGroup, EquipmentType, Exercise } from "@/types";
import { triggerAutoSync } from "@/lib/driveSync";

interface CreateExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (exercise: Exercise) => void;
}

const MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
  "Full Body",
  "Cardio",
];

const EQUIPMENT_TYPES: EquipmentType[] = [
  "Barbell",
  "Dumbbell",
  "Cable",
  "Machine",
  "Bodyweight",
  "Kettlebell",
  "Smith Machine",
  "Other",
];

export default function CreateExerciseModal({
  isOpen,
  onClose,
  onCreated,
}: CreateExerciseModalProps) {
  const [name, setName] = useState("");
  const [targetMuscle, setTargetMuscle] = useState<MuscleGroup>("Chest");
  const [equipment, setEquipment] = useState<EquipmentType>("Barbell");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Exercise name is required.");
      return;
    }

    const newExercise: Exercise = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      targetMuscle,
      equipment,
      instructions: instructions.trim() || undefined,
      isCustom: true,
      isArchived: false,
    };

    await db.exercises.add(newExercise);
    triggerAutoSync();

    setName("");
    setInstructions("");
    setError(null);

    if (onCreated) {
      onCreated(newExercise);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end p-0 sm:p-4 sm:justify-center sm:items-center">
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4">
        <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
          <h2 className="text-base font-bold text-white">Create Custom Exercise</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5 mt-3">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <label className="block text-xs uppercase font-semibold text-zinc-400 mb-1.5">
              Exercise Name *
            </label>
            <input
              type="text"
              placeholder="e.g., Bulgarian Split Squat"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-white rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase font-semibold text-zinc-400 mb-1.5">
                Target Muscle
              </label>
              <select
                value={targetMuscle}
                onChange={(e) => setTargetMuscle(e.target.value as MuscleGroup)}
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-white rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-colors"
              >
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase font-semibold text-zinc-400 mb-1.5">
                Equipment
              </label>
              <select
                value={equipment}
                onChange={(e) => setEquipment(e.target.value as EquipmentType)}
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-white rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-colors"
              >
                {EQUIPMENT_TYPES.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase font-semibold text-zinc-400 mb-1.5">
              Instructions / Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Form cues, bench angles, grip width..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-white rounded-xl px-3.5 py-2 text-sm text-white outline-none transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Save Exercise
          </button>
        </form>
      </div>
    </div>
  );
}