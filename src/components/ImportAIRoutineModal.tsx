// src/components/ImportAIRoutineModal.tsx
"use client";

import { useState } from "react";
import { X, Sparkles, Copy, Check, ArrowRight, AlertCircle } from "lucide-react";
import { db } from "@/db/database";
import { Exercise } from "@/types";

interface ImportAIRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  existingExercises: Exercise[];
}

export default function ImportAIRoutineModal({
  isOpen,
  onClose,
  onImportComplete,
  existingExercises,
}: ImportAIRoutineModalProps) {
  const [activeTab, setActiveTab] = useState<"prompt" | "paste">("prompt");
  const [copied, setCopied] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const promptText = `Now take all the routines we just planned and format them into this exact JSON structure so I can import them into Repwise. Return ONLY raw JSON inside a \`\`\`json block with no extra text or pleasantries:

[
  {
    "title": "Push Day",
    "exercises": [
      {
        "name": "Barbell Bench Press",
        "targetSets": 4,
        "targetReps": 8
      },
      {
        "name": "Incline Dumbbell Press",
        "targetSets": 3,
        "targetReps": 10
      }
    ]
  }
]`;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleParseAndImport = async () => {
    setErrorMsg(null);
    if (!jsonInput.trim()) {
      setErrorMsg("Please paste JSON routines first.");
      return;
    }

    setImporting(true);
    try {
      // 1. Fetch current routines to enforce limits and avoid duplicates
      const currentRoutines = await db.routines.toArray();

      let clean = jsonInput.trim();
      if (clean.includes("```")) {
        const matches = clean.match(/```(?:json)?([\s\S]*?)```/);
        if (matches && matches[1]) {
          clean = matches[1].trim();
        }
      }

      const parsed = JSON.parse(clean);
      const routinesArray = Array.isArray(parsed) ? parsed : [parsed];

      if (routinesArray.length === 0) {
        throw new Error("No routines found in JSON array.");
      }

      // Check max limit (10 routines)
      if (currentRoutines.length + routinesArray.length > 10) {
        throw new Error(
          `Routine limit reached. You have ${currentRoutines.length}/10 routines. Importing ${routinesArray.length} would exceed the maximum of 10.`
        );
      }

      // Track existing titles (case-insensitive)
      const existingTitles = new Set(
        currentRoutines.map((r) => r.title.trim().toLowerCase())
      );

      const exerciseMap = new Map(
        existingExercises.map((e) => [e.name.trim().toLowerCase(), e])
      );

      for (const r of routinesArray) {
        if (!r.title || !r.title.trim()) {
          throw new Error("A routine is missing a title.");
        }

        // Generate a unique title if a duplicate exists
        let uniqueTitle = r.title.trim();
        let counter = 2;
        while (existingTitles.has(uniqueTitle.toLowerCase())) {
          uniqueTitle = `${r.title.trim()} (${counter})`;
          counter++;
        }
        existingTitles.add(uniqueTitle.toLowerCase());

        const routineId = `rt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        await db.routines.add({
          id: routineId,
          title: uniqueTitle,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        if (Array.isArray(r.exercises)) {
          for (let i = 0; i < r.exercises.length; i++) {
            const exData = r.exercises[i];
            const exName = (exData.name || "Custom Exercise").trim();
            let exercise = exerciseMap.get(exName.toLowerCase());

            if (!exercise) {
              const newExId = `ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              exercise = {
                id: newExId,
                name: exName,
                targetMuscle: "Chest",
                equipment: "Other",
                isCustom: true,
              };
              await db.exercises.add(exercise);
              exerciseMap.set(exName.toLowerCase(), exercise);
            }

            await db.routineItems.add({
              id: `ri_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
              routineId,
              exerciseId: exercise.id,
              orderIndex: i + 1,
              targetSets: Number(exData.targetSets) || 3,
              targetReps: Number(exData.targetReps) || 10,
              restSeconds: 90,
            });
          }
        }
      }

      onImportComplete();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse JSON. Please check formatting.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 pb-20 select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 w-full max-w-md h-[82vh] max-h-[640px] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white" />
            <h2 className="text-base font-bold text-white">Import Routines with AI</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 p-1 bg-zinc-950 border border-zinc-800 rounded-xl my-3 shrink-0">
          <button
            onClick={() => setActiveTab("prompt")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "prompt"
                ? "bg-white text-black font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            1. Get Prompt
          </button>
          <button
            onClick={() => setActiveTab("paste")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "paste"
                ? "bg-white text-black font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            2. Paste & Import
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-4 flex-1 pr-1">
          {activeTab === "prompt" ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs space-y-2 text-zinc-300">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  How it works:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400 pl-1">
                  <li>Plan your routine with ChatGPT, Claude, or Gemini.</li>
                  <li>Copy the prompt below and send it to your AI chat.</li>
                  <li>Switch to the <strong>Paste & Import</strong> tab with the output.</li>
                </ol>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] uppercase font-semibold text-zinc-400">
                    Repwise Formatter Prompt
                  </span>
                  <span className="text-[10px] text-zinc-500">Max 10 routines</span>
                </div>
                <div className="relative">
                  <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] font-mono text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {promptText}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-semibold text-zinc-400 block">
                  Paste AI JSON Output
                </label>
                <textarea
                  rows={8}
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Paste the raw JSON code or ```json block from your AI here..."
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-xl p-3 text-xs font-mono text-white outline-none resize-none"
                />
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0"/>
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-3 border-t border-zinc-800 shrink-0">
          {activeTab === "prompt" ? (
            <div className="flex gap-2">
              <button
                onClick={handleCopyPrompt}
                className="flex-1 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
              >
                {copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                <span>{copied ? "Copied Prompt!" : "Copy Prompt"}</span>
              </button>
              <button
                onClick={() => setActiveTab("paste")}
                className="py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4"/>
              </button>
            </div>
          ) : (
            <button
              disabled={importing}
              onClick={handleParseAndImport}
              className="w-full py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 active:scale-95"
            >
              <span>{importing ? "Importing Routines..." : "Import Routines"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}