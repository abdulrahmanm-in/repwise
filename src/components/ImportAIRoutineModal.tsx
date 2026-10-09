// src/components/ImportAIRoutineModal.tsx
"use client";

import { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Copy,
  Check,
  ArrowRight,
  AlertCircle,
  Edit2,
  RefreshCw,
} from "lucide-react";
import { db } from "@/db/database";
import { Exercise, MuscleGroup, EquipmentType } from "@/types";
import { generateCanonicalKey } from "@/lib/exerciseKey";

interface ImportAIRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  existingExercises: Exercise[];
}

interface PendingRoutine {
  originalTitle: string;
  currentTitle: string;
  exercises: any[];
  isDuplicate: boolean;
  overwrite: boolean;
}

function normalizeEquipment(raw?: string, name: string = ""): EquipmentType {
  const val = (raw || "").toLowerCase().trim();
  const n = name.toLowerCase().trim();

  if (val.includes("barbell") || n.includes("barbell")) return "Barbell";
  if (val.includes("dumbbell") || n.includes("dumbbell")) return "Dumbbell";
  if (
    val.includes("cable") ||
    n.includes("cable") ||
    n.includes("pushdown") ||
    n.includes("face pull")
  )
    return "Cable";
  if (
    val.includes("machine") ||
    n.includes("machine") ||
    (n.includes("press") &&
      n.includes("chest press") &&
      !n.includes("dumbbell") &&
      !n.includes("barbell"))
  )
    return "Machine";
  if (
    val.includes("bodyweight") ||
    val.includes("body weight") ||
    val.includes("calisthenic") ||
    n.includes("pull-up") ||
    n.includes("chin-up") ||
    n.includes("dip") ||
    n.includes("push-up")
  )
    return "Bodyweight";
  if (val.includes("kettlebell") || n.includes("kettlebell")) return "Kettlebell";
  if (val.includes("smith") || n.includes("smith")) return "Smith Machine";

  if (
    n.includes("lateral raise") ||
    (n.includes("curl") && !n.includes("cable") && !n.includes("barbell"))
  ) {
    return "Dumbbell";
  }
  if (n.includes("bench press") || n.includes("deadlift") || n.includes("squat")) {
    return "Barbell";
  }

  return "Other";
}

function normalizeMuscle(raw?: string, name: string = ""): MuscleGroup {
  const val = (raw || "").toLowerCase().trim();
  const n = name.toLowerCase().trim();

  if (val.includes("chest") || val.includes("pec")) return "Chest";
  if (
    val.includes("back") ||
    val.includes("lat") ||
    val.includes("trap") ||
    val.includes("rear delt")
  )
    return "Back";
  if (
    val.includes("leg") ||
    val.includes("quad") ||
    val.includes("hamstring") ||
    val.includes("calf") ||
    val.includes("glute")
  )
    return "Legs";
  if (val.includes("shoulder") || val.includes("delt")) return "Shoulders";
  if (val.includes("arm") || val.includes("bicep") || val.includes("tricep"))
    return "Arms";
  if (val.includes("core") || val.includes("abs") || val.includes("abdominal"))
    return "Core";
  if (val.includes("cardio")) return "Cardio";

  if (
    n.includes("lateral raise") ||
    n.includes("overhead press") ||
    n.includes("military press") ||
    n.includes("front raise") ||
    n.includes("shoulder")
  ) {
    return "Shoulders";
  }
  if (
    n.includes("tricep") ||
    n.includes("bicep") ||
    n.includes("curl") ||
    n.includes("pushdown") ||
    n.includes("extension") ||
    n.includes("skull crusher") ||
    n.includes("dip")
  ) {
    return "Arms";
  }
  if (
    n.includes("row") ||
    n.includes("pulldown") ||
    n.includes("pull-up") ||
    n.includes("deadlift") ||
    n.includes("lat")
  ) {
    return "Back";
  }
  if (
    n.includes("squat") ||
    n.includes("lunge") ||
    n.includes("leg press") ||
    n.includes("calf raise") ||
    n.includes("hamstring") ||
    n.includes("quad")
  ) {
    return "Legs";
  }
  if (
    n.includes("crunch") ||
    n.includes("plank") ||
    n.includes("ab") ||
    n.includes("leg raise")
  ) {
    return "Core";
  }
  if (
    n.includes("chest") ||
    n.includes("bench press") ||
    n.includes("fly") ||
    n.includes("pec")
  ) {
    return "Chest";
  }

  return "Full Body";
}

export default function ImportAIRoutineModal({
  isOpen,
  onClose,
  onImportComplete,
  existingExercises,
}: ImportAIRoutineModalProps) {
  const [activeTab, setActiveTab] = useState<"prompt" | "paste" | "resolve">("prompt");
  const [copied, setCopied] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [pendingRoutines, setPendingRoutines] = useState<PendingRoutine[]>([]);
  const [existingTitlesSet, setExistingTitlesSet] = useState<Set<string>>(new Set());

  const resetModalState = () => {
    setActiveTab("prompt");
    setJsonInput("");
    setPendingRoutines([]);
    setErrorMsg(null);
    setImporting(false);
    setCopied(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetModalState();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    resetModalState();
    onClose();
  };

  const promptText = `Now format all the routines we just planned into this exact JSON structure for Repwise. Return ONLY raw JSON inside a \`\`\`json block with no extra text or pleasantries.

Guidelines:
- Use standard, natural exercise names (e.g. "Incline Dumbbell Press", "Lat Pulldown", "Barbell Back Squat").
- "targetMuscle" must be exactly one of: ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Full Body", "Cardio"]
- "equipment" must be exactly one of: ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Kettlebell", "Smith Machine", "Other"]

[
  {
    "title": "Push Day",
    "exercises": [
      {
        "name": "Incline Dumbbell Press",
        "targetMuscle": "Chest",
        "equipment": "Dumbbell",
        "targetSets": 3,
        "targetReps": 10
      },
      {
        "name": "Dumbbell Lateral Raise",
        "targetMuscle": "Shoulders",
        "equipment": "Dumbbell",
        "targetSets": 3,
        "targetReps": 15
      },
      {
        "name": "Tricep Pushdown",
        "targetMuscle": "Arms",
        "equipment": "Cable",
        "targetSets": 3,
        "targetReps": 12
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

  const handleAnalyzeJSON = async () => {
    setErrorMsg(null);
    if (!jsonInput.trim()) {
      setErrorMsg("Please paste JSON routines first.");
      return;
    }

    try {
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

      const currentRoutines = await db.routines.toArray();
      const existingTitles = new Set(
        currentRoutines.map((r) => r.title.trim().toLowerCase())
      );
      setExistingTitlesSet(existingTitles);

      // Check Custom Exercise Cap (max 50) using canonical keys
      const currentCustomExercises = await db.exercises.filter((ex) => Boolean(ex.isCustom)).toArray();
      const existingKeyMap = new Map<string, Exercise>();
      for (const ex of existingExercises) {
        existingKeyMap.set(
          generateCanonicalKey(ex.name, ex.targetMuscle, ex.equipment),
          ex
        );
      }

      const newCustomKeysToCreate = new Set<string>();
      for (const r of routinesArray) {
        if (Array.isArray(r.exercises)) {
          for (const ex of r.exercises) {
            const rawName = (ex.name || "").trim();
            const muscle = normalizeMuscle(ex.targetMuscle, rawName);
            const equip = normalizeEquipment(ex.equipment, rawName);
            const key = generateCanonicalKey(rawName, muscle, equip);

            if (!existingKeyMap.has(key) && !newCustomKeysToCreate.has(key)) {
              newCustomKeysToCreate.add(key);
            }
          }
        }
      }

      if (
        newCustomKeysToCreate.size > 0 &&
        currentCustomExercises.length + newCustomKeysToCreate.size > 50
      ) {
        throw new Error(
          `Custom exercise limit exceeded (${currentCustomExercises.length}/50). This import would add ${newCustomKeysToCreate.size} new custom exercise(s), which exceeds the 50-exercise maximum.`
        );
      }

      const reservedTitles = new Set(existingTitles);

      const staged: PendingRoutine[] = routinesArray.map((r) => {
        const title = (r.title || "Routine").trim();
        const isDuplicate = existingTitles.has(title.toLowerCase());

        let suggestedTitle = title;
        if (isDuplicate) {
          let counter = 2;
          suggestedTitle = `${title} (${counter})`;
          while (reservedTitles.has(suggestedTitle.toLowerCase())) {
            counter++;
            suggestedTitle = `${title} (${counter})`;
          }
          reservedTitles.add(suggestedTitle.toLowerCase());
        }

        return {
          originalTitle: title,
          currentTitle: suggestedTitle,
          exercises: Array.isArray(r.exercises) ? r.exercises : [],
          isDuplicate,
          overwrite: false,
        };
      });

      // Check Routine Cap (max 10)
      const genuinelyNewRoutinesCount = staged.filter(
        (s) => !s.overwrite && !existingTitles.has(s.currentTitle.trim().toLowerCase())
      ).length;

      if (
        genuinelyNewRoutinesCount > 0 &&
        currentRoutines.length + genuinelyNewRoutinesCount > 10
      ) {
        throw new Error(
          `Routine limit reached (${currentRoutines.length}/10). Importing ${genuinelyNewRoutinesCount} new routine(s) would exceed the maximum of 10.`
        );
      }

      const hasConflicts = staged.some((s) => s.isDuplicate);
      if (hasConflicts) {
        setPendingRoutines(staged);
        setActiveTab("resolve");
      } else {
        await executeImport(staged);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse JSON. Please check formatting.");
    }
  };

  const executeImport = async (routinesToSave: PendingRoutine[]) => {
    setErrorMsg(null);
    setImporting(true);
    try {
      const currentRoutines = await db.routines.toArray();
      const existingRoutineMap = new Map(
        currentRoutines.map((r) => [r.title.trim().toLowerCase(), r])
      );

      // Verify Routine Limit
      const genuinelyNewCount = routinesToSave.filter(
        (r) => !r.overwrite && !existingRoutineMap.has(r.currentTitle.trim().toLowerCase())
      ).length;

      if (genuinelyNewCount > 0 && currentRoutines.length + genuinelyNewCount > 10) {
        throw new Error(
          `Routine limit reached (${currentRoutines.length}/10). You cannot exceed 10 routines.`
        );
      }

      // Verify Custom Exercise Limit (max 50) using canonical keys
      const currentCustomExercises = await db.exercises.filter((ex) => Boolean(ex.isCustom)).toArray();
      const activeKeyMap = new Map<string, Exercise>();
      for (const ex of existingExercises) {
        activeKeyMap.set(
          generateCanonicalKey(ex.name, ex.targetMuscle, ex.equipment),
          ex
        );
      }

      const brandNewKeys = new Set<string>();
      for (const r of routinesToSave) {
        for (const ex of r.exercises) {
          const rawName = (ex.name || "").trim();
          const muscle = normalizeMuscle(ex.targetMuscle, rawName);
          const equip = normalizeEquipment(ex.equipment, rawName);
          const key = generateCanonicalKey(rawName, muscle, equip);

          if (!activeKeyMap.has(key) && !brandNewKeys.has(key)) {
            brandNewKeys.add(key);
          }
        }
      }

      if (
        brandNewKeys.size > 0 &&
        currentCustomExercises.length + brandNewKeys.size > 50
      ) {
        throw new Error(
          `Custom exercise limit reached (${currentCustomExercises.length}/50). Adding ${brandNewKeys.size} new exercise(s) exceeds the maximum of 50.`
        );
      }

      // Validate title uniqueness
      const seenBatchNames = new Set<string>();
      for (const r of routinesToSave) {
        const trimmed = r.currentTitle.trim();
        const key = trimmed.toLowerCase();

        if (!trimmed) {
          throw new Error("Routine titles cannot be blank.");
        }

        if (seenBatchNames.has(key)) {
          throw new Error(`Multiple routines have the name "${trimmed}". Names must be unique.`);
        }
        seenBatchNames.add(key);

        if (!r.overwrite && existingRoutineMap.has(key)) {
          throw new Error(
            `A routine named "${trimmed}" already exists in your library. Change the name or select "Overwrite".`
          );
        }
      }

      for (const r of routinesToSave) {
        let routineId: string;
        const targetTitle = r.currentTitle.trim();
        const existingTarget = existingRoutineMap.get(
          r.overwrite ? r.originalTitle.trim().toLowerCase() : targetTitle.toLowerCase()
        );

        if (r.overwrite && existingTarget) {
          routineId = existingTarget.id;
          await db.routines.update(routineId, {
            title: targetTitle,
            updatedAt: Date.now(),
          });
          await db.routineItems.where("routineId").equals(routineId).delete();
        } else {
          routineId = `rt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          await db.routines.add({
            id: routineId,
            title: targetTitle,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }

        for (let i = 0; i < r.exercises.length; i++) {
          const exData = r.exercises[i];
          const rawName = (exData.name || "Exercise").trim();
          const targetMuscle = normalizeMuscle(exData.targetMuscle, rawName);
          const equipment = normalizeEquipment(exData.equipment, rawName);
          const key = generateCanonicalKey(rawName, targetMuscle, equipment);

          let exercise = activeKeyMap.get(key);

          if (!exercise) {
            const newExId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            exercise = {
              id: newExId,
              name: rawName, // Preserves natural name in UI
              targetMuscle,
              equipment,
              isCustom: true,
              isArchived: false,
            };
            await db.exercises.add(exercise);
            activeKeyMap.set(key, exercise);
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

      onImportComplete();
      resetModalState();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save routines.");
    } finally {
      setImporting(false);
    }
  };

  const hasInvalidTitles = pendingRoutines.some((r) => {
    const trimmed = r.currentTitle.trim().toLowerCase();
    if (!trimmed) return true;
    if (!r.overwrite && existingTitlesSet.has(trimmed)) return true;
    return false;
  });

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 pb-20 select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 w-full max-w-md h-[84vh] max-h-[660px] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center pb-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white" />
            <h2 className="text-base font-bold text-white">Import Routines with AI</h2>
          </div>
          <button onClick={handleClose} className="text-zinc-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeTab !== "resolve" && (
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
        )}

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
          ) : activeTab === "paste" ? (
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
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  Routine Name Conflicts
                </p>
                <p className="text-[11px] text-zinc-400">
                  Some routines match existing ones. Rename them below or select Overwrite to replace previous entries.
                </p>
              </div>

              <div className="space-y-2.5">
                {pendingRoutines.map((routine, idx) => {
                  const isTitleTaken =
                    !routine.overwrite &&
                    existingTitlesSet.has(routine.currentTitle.trim().toLowerCase());

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Routine #{idx + 1} ({routine.exercises.length} exercises)
                        </span>
                        {routine.isDuplicate && (
                          <span
                            className={`text-[10px] border px-2 py-0.5 rounded-full font-semibold ${
                              routine.overwrite
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            }`}
                          >
                            {routine.overwrite ? "Will Overwrite" : "Duplicate Title"}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
                            <Edit2 className="w-3 h-3 text-zinc-500"/>
                            <span>Routine Title:</span>
                          </label>
                          {isTitleTaken && (
                            <span className="text-[10px] text-rose-400 font-medium">
                              Name already taken
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={routine.currentTitle}
                          disabled={routine.overwrite}
                          onChange={(e) => {
                            const updated = [...pendingRoutines];
                            updated[idx].currentTitle = e.target.value;
                            setPendingRoutines(updated);
                            setErrorMsg(null);
                          }}
                          className={`w-full bg-zinc-900 border rounded-lg px-2.5 py-1.5 text-xs text-white outline-none ${
                            routine.overwrite
                              ? "border-zinc-800 opacity-50"
                              : isTitleTaken
                              ? "border-rose-500/70 focus:border-rose-500"
                              : "border-zinc-700 focus:border-zinc-500"
                          }`}
                        />
                      </div>

                      {routine.isDuplicate && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...pendingRoutines];
                            const nextState = !updated[idx].overwrite;
                            updated[idx].overwrite = nextState;
                            if (nextState) {
                              updated[idx].currentTitle = updated[idx].originalTitle;
                            }
                            setPendingRoutines(updated);
                            setErrorMsg(null);
                          }}
                          className={`text-[11px] font-semibold flex items-center gap-1.5 transition-colors pt-1 ${
                            routine.overwrite
                              ? "text-emerald-400"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <RefreshCw className="w-3 h-3"/>
                          <span>
                            {routine.overwrite
                              ? "✓ Overwriting existing routine"
                              : "Overwrite existing routine instead"}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-zinc-800 shrink-0 space-y-2">
          {errorMsg && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0"/>
              <span>{errorMsg}</span>
            </div>
          )}

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
          ) : activeTab === "paste" ? (
            <button
              disabled={importing}
              onClick={handleAnalyzeJSON}
              className="w-full py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 active:scale-95"
            >
              <span>{importing ? "Processing..." : "Import Routines"}</span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setActiveTab("paste");
                }}
                className="py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Back
              </button>
              <button
                disabled={importing || hasInvalidTitles}
                onClick={() => executeImport(pendingRoutines)}
                className="flex-1 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-40 active:scale-95"
              >
                <span>{importing ? "Saving..." : "Confirm & Import"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}