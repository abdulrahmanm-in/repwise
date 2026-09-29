// src/components/ImportAIRoutineModal.tsx
"use client";

import { useState } from "react";
import { db } from "@/db/database";
import { Exercise, MuscleGroup, EquipmentType } from "@/types";
import {
  Sparkles,
  X,
  Copy,
  Check,
  ArrowRight,
  MessageSquareQuote,
  FileJson,
  Layers,
} from "lucide-react";
import clsx from "clsx";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  existingExercises: Exercise[];
}

interface RoutinePayload {
  title: string;
  exercises: {
    name: string;
    targetMuscle?: MuscleGroup;
    equipment?: EquipmentType;
    sets: number;
    reps: number;
    restSeconds?: number;
  }[];
}

const AI_PROMPT_TEMPLATE = `Now take all the routines we just planned and format them into this exact JSON structure so I can import them into Repwise. Return ONLY raw JSON inside a \`\`\`json block with no extra text or pleasantries:

[
  {
    "title": "Push Day",
    "exercises": [
      {
        "name": "Barbell Bench Press",
        "targetMuscle": "Chest",
        "equipment": "Barbell",
        "sets": 3,
        "reps": 10,
        "restSeconds": 90
      },
      {
        "name": "Incline Dumbbell Press",
        "targetMuscle": "Chest",
        "equipment": "Dumbbell",
        "sets": 3,
        "reps": 10,
        "restSeconds": 90
      }
    ]
  }
]`;

export default function ImportAIRoutineModal({
  isOpen,
  onClose,
  onImportComplete,
  existingExercises,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [rawInput, setRawInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = AI_PROMPT_TEMPLATE;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleParseAndImport = async () => {
    if (!rawInput.trim()) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // 1. Clean JSON fences if copied directly from markdown
      let clean = rawInput.trim();
      if (clean.includes("```json")) {
        clean = clean.split("```json")[1].split("```")[0].trim();
      } else if (clean.includes("```")) {
        clean = clean.split("```")[1].split("```")[0].trim();
      }

      let parsed: RoutinePayload[] = [];
      const jsonCandidate = JSON.parse(clean);

      if (Array.isArray(jsonCandidate)) {
        parsed = jsonCandidate;
      } else if (typeof jsonCandidate === "object" && jsonCandidate !== null) {
        // Single routine format fallback
        parsed = [jsonCandidate];
      }

      if (parsed.length === 0) {
        throw new Error("No routines found in the pasted data.");
      }

      // 2. Iterate each routine and save to Dexie
      for (let rIdx = 0; rIdx < parsed.length; rIdx++) {
        const item = parsed[rIdx];
        const routineId = `rt_ai_${Date.now()}_${rIdx}`;

        await db.routines.add({
          id: routineId,
          title: item.title || `AI Routine ${rIdx + 1}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        if (Array.isArray(item.exercises)) {
          for (let eIdx = 0; eIdx < item.exercises.length; eIdx++) {
            const exData = item.exercises[eIdx];
            const cleanName = exData.name?.trim();
            if (!cleanName) continue;

            // Check if exercise exists in DB
            let matched = existingExercises.find(
              (e) => e.name.toLowerCase() === cleanName.toLowerCase()
            );

            if (!matched) {
              matched = existingExercises.find(
                (e) =>
                  e.name.toLowerCase().includes(cleanName.toLowerCase()) ||
                  cleanName.toLowerCase().includes(e.name.toLowerCase())
              );
            }

            let exerciseId = matched?.id;

            // If not found, register as custom exercise
            if (!exerciseId) {
              exerciseId = `custom_${Date.now()}_${rIdx}_${eIdx}`;
              await db.exercises.add({
                id: exerciseId,
                name: cleanName,
                targetMuscle: exData.targetMuscle || "Chest",
                equipment: exData.equipment || "Barbell",
                isCustom: true,
                isArchived: false,
              });
            }

            // Add item to routine
            await db.routineItems.add({
              id: `ri_${Date.now()}_${rIdx}_${eIdx}`,
              routineId,
              exerciseId,
              orderIndex: eIdx + 1,
              targetSets: Number(exData.sets) || 3,
              targetReps: Number(exData.reps) || 10,
              restSeconds: Number(exData.restSeconds) || 90,
            });
          }
        }
      }

      onImportComplete();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        "Could not parse the pasted text. Make sure you pasted the exact JSON format produced by the prompt."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-lg max-h-[90vh] flex flex-col space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white" />
            <h2 className="text-base font-bold text-white">Import Routines with AI</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-semibold">
          <button
            onClick={() => setActiveStep(1)}
            className={clsx(
              "py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all",
              activeStep === 1
                ? "bg-white text-black font-bold"
                : "text-zinc-400 hover:text-white"
            )}
          >
            <MessageSquareQuote className="w-3.5 h-3.5" /> 1. Get Prompt
          </button>
          <button
            onClick={() => setActiveStep(2)}
            className={clsx(
              "py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all",
              activeStep === 2
                ? "bg-white text-black font-bold"
                : "text-zinc-400 hover:text-white"
            )}
          >
            <FileJson className="w-3.5 h-3.5" /> 2. Paste & Import
          </button>
        </div>

        {/* STEP 1: GUIDANCE & PROMPT COPY */}
        {activeStep === 1 && (
          <div className="space-y-4 py-1">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-2 text-xs leading-relaxed text-zinc-300">
              <p className="font-semibold text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-white" /> How it works:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-zinc-400 pl-0.5">
                <li>
                  Open <span className="text-white font-medium">ChatGPT</span>,{" "}
                  <span className="text-white font-medium">Claude</span>, or{" "}
                  <span className="text-white font-medium">Gemini</span>.
                </li>
                <li>
                  Discuss your goals (e.g. <em>&quot;Create a 3-day Push/Pull/Legs program for hypertrophy&quot;</em>).
                </li>
                <li>
                  Copy the prompt below and paste it as your final message to get the exact structured code.
                </li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Repwise Formatter Prompt
                </span>
                <span className="text-[10px] text-zinc-500">Supports single & multiple splits</span>
              </div>
              <div className="relative">
                <textarea
                  readOnly
                  rows={6}
                  value={AI_PROMPT_TEMPLATE}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono text-zinc-300 outline-none resize-none select-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleCopyPrompt}
                className="py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-zinc-700 transition-all active:scale-98"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" /> Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Prompt
                  </>
                )}
              </button>

              <button
                onClick={() => setActiveStep(2)}
                className="py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-98"
              >
                Next Step <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PASTE & INSTANT MULTI-ROUTINE GENERATION */}
        {activeStep === 2 && (
          <div className="space-y-4 py-1">
            {errorMsg && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
                {errorMsg}
              </p>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Paste AI Response *
                </label>
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setRawInput(text);
                    } catch {}
                  }}
                  className="text-[10px] text-zinc-400 hover:text-white underline"
                >
                  Paste from clipboard
                </button>
              </div>

              <textarea
                rows={9}
                placeholder='Paste the JSON response from your AI here...'
                value={rawInput}
                onChange={(e) => {
                  setRawInput(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white font-mono outline-none resize-none focus:border-white placeholder:text-zinc-600"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => setActiveStep(1)}
                className="py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs transition-all"
              >
                Back
              </button>

              <button
                disabled={!rawInput.trim() || isProcessing}
                onClick={handleParseAndImport}
                className="col-span-2 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-40 active:scale-98"
              >
                {isProcessing ? "Building Routines..." : "Generate Routines"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}