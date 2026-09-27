// src/app/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Download,
  Upload,
  Cloud,
  HardDrive,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Dumbbell,
  Search,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { Exercise } from "@/types";
import CreateExerciseModal from "@/components/CreateExerciseModal";
import { exportDatabaseToJSON, importDatabaseFromJSON } from "@/lib/jsonBackup";
import {
  initGoogleAuth,
  requestDriveAuth,
  uploadBackupToDrive,
  restoreLatestFromDrive,
} from "@/lib/driveBackup";
import { triggerAutoSync } from "@/lib/driveSync";

export default function SettingsView() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");

  const exercises =
    useLiveQuery<Exercise[]>(() => db.exercises.toArray(), []) || [];

  useEffect(() => {
    initGoogleAuth(() => setDriveConnected(true));
  }, []);

  const filteredExercises = exercises.filter(
    (e) =>
      e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
      e.targetMuscle.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
      e.equipment.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const handleDeleteExercise = async (exercise: Exercise) => {
    if (!exercise.isCustom) return;
    if (confirm(`Delete custom exercise "${exercise.name}"?`)) {
      await db.exercises.delete(exercise.id);
      triggerAutoSync();
    }
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
    setStatusMessage("JSON backup downloaded successfully.");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      const success = await importDatabaseFromJSON(content);
      if (success) {
        setStatusMessage("Data imported successfully! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatusMessage("Error importing file. Invalid schema.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-12">
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

      {/* 1. Exercise Library Manager */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-white" />
            <h2 className="text-xs uppercase font-semibold text-zinc-200">
              Exercise Library ({exercises.length})
            </h2>
          </div>
          <button
            onClick={() => setIsExerciseModalOpen(true)}
            className="flex items-center gap-1 bg-white text-black hover:bg-zinc-200 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add Exercise
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search exercises..."
            value={exerciseSearch}
            onChange={(e) => setExerciseSearch(e.target.value)}
            className="w-full bg-zinc-800/80 border border-zinc-700/80 focus:border-white rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none"
          />
        </div>

        {/* List of Exercises */}
        <div className="max-h-60 overflow-y-auto divide-y divide-zinc-800/60 pr-1">
          {filteredExercises.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">No exercises found.</p>
          ) : (
            filteredExercises.map((ex) => (
              <div
                key={ex.id}
                className="py-2.5 px-1 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-white">{ex.name}</span>
                    {ex.isCustom && (
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 font-semibold">
                        Custom
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {ex.targetMuscle} • {ex.equipment}
                  </span>
                </div>

                {ex.isCustom && (
                  <button
                    onClick={() => handleDeleteExercise(ex)}
                    className="text-zinc-600 hover:text-rose-400 p-1 transition-colors"
                    title="Delete custom exercise"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. File Backup Ops */}
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
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 3. Cloud Integration */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <Cloud className="w-4 h-4 text-white" />
          <h2 className="text-xs uppercase font-semibold text-zinc-300">
            Google Drive AppData
          </h2>
        </div>

        {!driveConnected ? (
          <button
            onClick={requestDriveAuth}
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
                className="py-2 bg-white text-black font-semibold hover:bg-zinc-200 rounded-xl text-xs"
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

      {/* Modal for creating a new custom exercise */}
      <CreateExerciseModal
        isOpen={isExerciseModalOpen}
        onClose={() => setIsExerciseModalOpen(false)}
      />
    </div>
  );
}