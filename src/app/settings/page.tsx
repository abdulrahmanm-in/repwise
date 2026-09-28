"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { MuscleGroup, EquipmentType } from "@/types";
import { Download, Upload, Cloud, HardDrive, Check, AlertCircle, Plus, X } from "lucide-react";
import { exportDatabaseToJSON, importDatabaseFromJSON } from "@/lib/jsonBackup";
import { requestDriveAuth, uploadBackupToDrive, restoreLatestFromDrive } from "@/lib/driveBackup";

export default function SettingsView() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);

  // New Exercise Form State
  const [name, setName] = useState("");
  const [targetMuscle, setTargetMuscle] = useState<MuscleGroup>("Chest");
  const [equipment, setEquipment] = useState<EquipmentType>("Barbell");
  const [instructions, setInstructions] = useState("");

  const settings = useLiveQuery(() => db.settings.get("current"));
  const exercises = useLiveQuery(() => db.exercises.toArray()) || [];

  const handleCreateExercise = async () => {
    if (!name.trim()) return;
    await db.exercises.add({
      id: `custom_${Date.now()}`,
      name: name.trim(),
      targetMuscle,
      equipment,
      instructions: instructions.trim() || undefined,
      isCustom: true,
      isArchived: false,
    });
    setName("");
    setInstructions("");
    setShowAddExercise(false);
    setStatusMessage("Custom exercise created!");
  };

  const handleExportJSON = async () => {
    const json = await exportDatabaseToJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `repwise_backup_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage("JSON backup downloaded.");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      const success = await importDatabaseFromJSON(content);
      if (success) {
        setStatusMessage("Data imported! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatusMessage("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-28">
      <header className="pt-2">
        <h1 className="text-xl font-bold">Data & Settings</h1>
        <p className="text-xs text-zinc-400">Manage exercise library and storage</p>
      </header>

      {statusMessage && (
        <div className="p-3 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-white" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Exercise Library Management */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
          <span className="text-xs font-semibold text-zinc-300 uppercase">Exercise Library ({exercises.length})</span>
          <button
            onClick={() => setShowAddExercise(true)}
            className="text-xs bg-white text-black font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Exercise
          </button>
        </div>
        <div className="max-h-40 overflow-y-auto divide-y divide-zinc-800/40 text-xs">
          {exercises.map((e) => (
            <div key={e.id} className="py-2 flex justify-between items-center">
              <div>
                <p className="text-zinc-200 font-medium">{e.name}</p>
                <span className="text-[10px] text-zinc-500">{e.targetMuscle} • {e.equipment}</span>
              </div>
              {e.isCustom && (
                <button
                  onClick={() => db.exercises.delete(e.id)}
                  className="text-zinc-500 hover:text-rose-400"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* File Backup */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <HardDrive className="w-4 h-4 text-zinc-400" />
          <h2 className="text-xs uppercase font-semibold text-zinc-300">File Backup</h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold border border-zinc-700"
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <label className="flex items-center justify-center gap-2 py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold border border-zinc-700 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Import JSON
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </div>

      {/* Cloud Integration */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <Cloud className="w-4 h-4 text-white" />
          <h2 className="text-xs uppercase font-semibold text-zinc-300">Google Drive AppData</h2>
        </div>

        {!settings?.googleDriveLinked ? (
          <button
            onClick={async () => {
              try {
                await requestDriveAuth();
                setStatusMessage("Google Drive successfully connected!");
              } catch (err: any) {
                setStatusMessage(err.message || "Failed to connect Google Account.");
              }
            }}
            className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2"
          >
            Connect Google Account
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 pb-1">
              <Check className="w-3.5 h-3.5" /> Connected to Google Drive
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  try {
                    await uploadBackupToDrive();
                    setStatusMessage("Drive backup uploaded successfully.");
                  } catch (e: any) {
                    setStatusMessage(e.message);
                  }
                }}
                className="py-2 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-semibold"
              >
                Upload to Drive
              </button>
              <button
                onClick={async () => {
                  if (confirm("Replace local data with latest Drive backup?")) {
                    try {
                      await restoreLatestFromDrive();
                      setStatusMessage("Data restored from Drive! Reloading...");
                      setTimeout(() => window.location.reload(), 1500);
                    } catch (e: any) {
                      setStatusMessage(e.message);
                    }
                  }
                }}
                className="py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold"
              >
                Restore from Drive
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE CUSTOM EXERCISE MODAL (Fixed Submit Button Visibility) */}
      {showAddExercise && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-2xl p-5 max-h-[85vh] flex flex-col space-y-4 pb-28 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h2 className="font-bold text-base text-white">Create Custom Exercise</h2>
              <button onClick={() => setShowAddExercise(false)} className="text-zinc-400 hover:text-white">
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
                    <option key={m} value={m}>{m}</option>
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
                  {["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight"].map((eq) => (
                    <option key={eq} value={eq}>{eq}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                Instructions / Notes
              </label>
              <textarea
                placeholder="Form cues, bench angles, grip width..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white outline-none focus:border-white"
              />
            </div>

            {/* Clearly Visible Submit Button */}
            <div className="pt-2">
              <button
                disabled={!name.trim()}
                onClick={handleCreateExercise}
                className="w-full py-3 bg-white text-black font-bold rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-200 transition-all shadow-md active:scale-[0.98]"
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
