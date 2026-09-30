// src/app/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Download,
  Upload,
  Cloud,
  HardDrive,
  Check,
  AlertCircle,
  Smartphone,
  Share2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  FileText,
  Timer,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { exportDatabaseToJSON, importDatabaseFromJSON } from "@/lib/jsonBackup";
import {
  initGoogleAuth,
  requestDriveAuth,
  getStoredAccessToken,
  disconnectGoogleDrive,
  deleteDriveAppDataBackup,
} from "@/lib/driveBackup";
import {
  fetchAndStoreGoogleProfile,
  getStoredUserProfile,
  clearStoredUserProfile,
  pullLatestFromDrive,
  pushLatestToDrive,
  performFullLogout,
  wipeAllLocalData,
  GoogleUserProfile,
} from "@/lib/driveSync";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function SettingsView() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [userProfile, setUserProfile] = useState<GoogleUserProfile | null>(null);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [syncState, setSyncState] = useState<{
    loading: boolean;
    message: string;
    subMessage: string;
  }>({
    loading: false,
    message: "",
    subMessage: "",
  });

  // Modal State for Danger Zone Deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState("");

  const { isInstalled, isIOS, canInstall, triggerInstall } = usePWAInstall();

  useEffect(() => {
    // Rest timer preference
    const savedTimerPref = localStorage.getItem("repwise_rest_timer_enabled");
    if (savedTimerPref !== null) {
      setTimerEnabled(savedTimerPref === "true");
    }

    const token = getStoredAccessToken();
    const cachedProfile = getStoredUserProfile();

    if (token) {
      setDriveConnected(true);
      if (cachedProfile) {
        setUserProfile(cachedProfile);
      } else {
        fetchAndStoreGoogleProfile(token).then((profile) => {
          if (profile) setUserProfile(profile);
        });
      }
    }

    initGoogleAuth(async (newToken: string) => {
      setDriveConnected(true);
      setSyncState({
        loading: true,
        message: "Authenticating with Google",
        subMessage: "Connecting to Google Drive AppData...",
      });

      const profile = await fetchAndStoreGoogleProfile(newToken);
      if (profile) setUserProfile(profile);

      setSyncState({
        loading: true,
        message: "Restoring Workout Data",
        subMessage: "Fetching latest workout history...",
      });

      const synced = await pullLatestFromDrive();
      setSyncState({ loading: false, message: "", subMessage: "" });

      if (synced) {
        setStatusMessage("Cloud sync complete! Refreshing interface...");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setStatusMessage("Signed in! Repwise is synced with your Google Drive.");
      }
    });
  }, []);

  const handleToggleTimer = () => {
    const nextVal = !timerEnabled;
    setTimerEnabled(nextVal);
    localStorage.setItem("repwise_rest_timer_enabled", String(nextVal));
  };

  const handleDisconnect = () => {
    disconnectGoogleDrive();
    clearStoredUserProfile();
    setDriveConnected(false);
    setUserProfile(null);
    setStatusMessage("Disconnected Google account.");
    window.dispatchEvent(new Event("repwise_auth_changed"));
  };

  const handleManualPush = async () => {
    setSyncState({
      loading: true,
      message: "Backing Up to Drive",
      subMessage: "Pushing local workout logs...",
    });
    try {
      const success = await pushLatestToDrive();
      if (success) {
        setStatusMessage("Latest data successfully saved to Google Drive.");
      } else {
        setStatusMessage("Sync failed. Check your network connection.");
      }
    } catch {
      setStatusMessage("Push failed. Please try again.");
    } finally {
      setSyncState({ loading: false, message: "", subMessage: "" });
    }
  };

  const handleManualPull = async () => {
    if (!confirm("This will replace current local entries with the latest Drive backup. Proceed?")) {
      return;
    }
    setSyncState({
      loading: true,
      message: "Restoring from Drive",
      subMessage: "Fetching latest workout history...",
    });
    try {
      const success = await pullLatestFromDrive();
      if (success) {
        setStatusMessage("Data restored from Drive! Reloading...");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setStatusMessage("Restore failed or no backup exists yet.");
      }
    } catch {
      setStatusMessage("Pull failed. Please try again.");
    } finally {
      setSyncState({ loading: false, message: "", subMessage: "" });
    }
  };

  const handleConfirmDeleteAll = async () => {
    if (deleteInputText.trim().toUpperCase() !== "DELETE") return;

    setShowDeleteModal(false);
    setSyncState({
      loading: true,
      message: "Purging Data",
      subMessage: driveConnected
        ? "Clearing local storage & Google Drive..."
        : "Clearing local storage...",
    });

    try {
      if (driveConnected) {
        await deleteDriveAppDataBackup();
      }
      await wipeAllLocalData();
      alert("All data has been permanently cleared.");
      window.location.reload();
    } catch (e: any) {
      alert(`Failed to delete data: ${e.message || e}`);
    } finally {
      setSyncState({ loading: false, message: "", subMessage: "" });
      setDeleteInputText("");
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
    <div className="space-y-6 pb-36">
      <LoadingOverlay
        isLoading={syncState.loading}
        message={syncState.message}
        subMessage={syncState.subMessage}
      />

      <header className="pt-2">
        <h1 className="text-xl font-bold tracking-tight text-white">Data & Settings</h1>
        <p className="text-xs text-zinc-400">Manage preferences, cloud sync, and backups</p>
      </header>

      {statusMessage && (
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-white shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* WORKOUT PREFERENCES (Rest Timer Toggle) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Timer className="w-4 h-4 text-white" />
            <div>
              <p className="text-xs font-semibold text-white">Rest Timer</p>
              <p className="text-[11px] text-zinc-400">
                Automatically start timer when completing a set
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleTimer}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
              timerEnabled ? "bg-white" : "bg-zinc-800"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full transition-transform ${
                timerEnabled ? "translate-x-5 bg-black" : "translate-x-0 bg-zinc-500"
              }`}
            />
          </button>
        </div>
      </div>

      {/* INSTALL APP ON HOME SCREEN */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-white" />
            <h2 className="text-xs uppercase font-semibold text-zinc-300">Install Repwise App</h2>
          </div>
          {isInstalled && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" /> Installed
            </span>
          )}
        </div>

        {isInstalled ? (
          <p className="text-xs text-zinc-400 leading-relaxed">
            Repwise is currently running as a standalone app.
          </p>
        ) : canInstall ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Install Repwise to your home screen for instant offline gym access.
            </p>
            <button
              onClick={triggerInstall}
              className="w-full py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-sm"
            >
              <Download className="w-4 h-4" /> Add to Home Screen
            </button>
          </div>
        ) : isIOS ? (
          <div className="space-y-2 text-xs text-zinc-400 leading-relaxed bg-zinc-950 border border-zinc-800/80 p-3 rounded-xl">
            <p className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-white" /> How to install on iOS:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-zinc-400 pl-1">
              <li>Tap <span className="text-white font-medium">Share</span> in Safari.</li>
              <li>Tap <span className="text-white font-medium">Add to Home Screen</span>.</li>
              <li>Tap <span className="text-white font-medium">Add</span>.</li>
            </ol>
          </div>
        ) : (
          <p className="text-xs text-zinc-400 leading-relaxed">
            Open your browser menu and tap <span className="text-white font-medium">Install app</span> or <span className="text-white font-medium">Add to Home screen</span>.
          </p>
        )}
      </div>

      {/* GOOGLE DRIVE SYNC CARD */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-white" />
            <h2 className="text-xs uppercase font-semibold text-zinc-300">Cloud Storage (Google Drive)</h2>
          </div>
          {driveConnected && (
            <button
              onClick={handleDisconnect}
              className="text-[11px] text-zinc-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
            >
              <LogOut className="w-3 h-3" /> Disconnect
            </button>
          )}
        </div>

        {!driveConnected ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Connect Google Drive to preserve routines and logs in your private Drive AppData folder[cite: 1, 2].
            </p>
            <button
              onClick={requestDriveAuth}
              className="w-full py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              Sign In with Google
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {userProfile && (
              <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                {userProfile.picture ? (
                  <Image
                    src={userProfile.picture}
                    alt={userProfile.name}
                    width={40}
                    height={40}
                    className="rounded-full border border-zinc-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-sm text-white">
                    {userProfile.name.charAt(0)}
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-white truncate">{userProfile.name}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{userProfile.email}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              <span>Auto-sync active across workouts</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                disabled={syncState.loading}
                onClick={handleManualPush}
                className="py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Push to Drive
              </button>
              <button
                disabled={syncState.loading}
                onClick={handleManualPull}
                className="py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Pull from Drive
              </button>
            </div>
          </div>
        )}
      </div>

      {/* OFFLINE JSON FILE BACKUP */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <HardDrive className="w-4 h-4 text-zinc-400" />
          <h2 className="text-xs uppercase font-semibold text-zinc-300">Offline File Backup</h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold border border-zinc-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <label className="flex items-center justify-center gap-2 py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold border border-zinc-700 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" /> Import JSON
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 pb-1 text-rose-400">
          <AlertTriangle className="w-4 h-4" />
          <h2 className="text-xs uppercase font-bold tracking-wider">Danger Zone</h2>
        </div>
        <p className="text-xs text-zinc-400">
          Permanently erase all your workout history, routines, and custom exercises.
        </p>
        <button
          onClick={() => {
            setDeleteInputText("");
            setShowDeleteModal(true);
          }}
          className="w-full py-2.5 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.99]"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete All Data</span>
        </button>
      </div>

      {/* LOGOUT BUTTON (Spaced away from danger zone) */}
      <div className="pt-2">
        <button
          onClick={() => {
            if (confirm("Log out completely and return to the login screen?")) {
              performFullLogout(true);
            }
          }}
          className="w-full py-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 active:scale-[0.99]"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>

      {/* LEGAL & POLICY LINKS */}
      <div className="pt-2 border-t border-zinc-800/80">
        <div className="flex items-center justify-center gap-4 text-xs text-zinc-400">
          <Link
            href="/terms"
            className="flex items-center gap-1 hover:text-white transition-colors underline-offset-4 hover:underline"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span>Terms and Conditions</span>
          </Link>
          <span className="text-zinc-700">•</span>
          <Link
            href="/privacy"
            className="flex items-center gap-1 hover:text-white transition-colors underline-offset-4 hover:underline"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
            <span>Privacy Policy</span>
          </Link>
        </div>
        <p className="text-center text-[10px] text-zinc-600 font-mono mt-2">
          Repwise • Local-First • Version 1.0.0
        </p>
      </div>

      {/* Permanent Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete All Data?</h3>
                <p className="text-xs text-zinc-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              This will permanently delete all workouts, custom exercises, routines, and backups
              {driveConnected ? " from this device and Google Drive" : ""}.
            </p>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-semibold text-zinc-400 block">
                Type <span className="font-mono text-white font-bold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                autoFocus
                placeholder="DELETE"
                value={deleteInputText}
                onChange={(e) => setDeleteInputText(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono tracking-widest uppercase"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteInputText.trim().toUpperCase() !== "DELETE"}
                onClick={handleConfirmDeleteAll}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}