// src/app/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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
} from "lucide-react";
import { exportDatabaseToJSON, importDatabaseFromJSON } from "@/lib/jsonBackup";
import {
  initGoogleAuth,
  requestDriveAuth,
  getStoredAccessToken,
  disconnectGoogleDrive,
} from "@/lib/driveBackup";
import {
  fetchAndStoreGoogleProfile,
  getStoredUserProfile,
  clearStoredUserProfile,
  pullLatestFromDrive,
  pushLatestToDrive,
  performFullLogout,
  GoogleUserProfile,
} from "@/lib/driveSync";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function SettingsView() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [userProfile, setUserProfile] = useState<GoogleUserProfile | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { isInstalled, isIOS, canInstall, triggerInstall } = usePWAInstall();

  useEffect(() => {
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
      setStatusMessage("Authenticating with Google...");

      const profile = await fetchAndStoreGoogleProfile(newToken);
      if (profile) setUserProfile(profile);

      setStatusMessage("Checking Google Drive for existing workouts...");
      setIsSyncing(true);
      const synced = await pullLatestFromDrive();
      setIsSyncing(false);

      if (synced) {
        setStatusMessage("Cloud sync complete! Refreshing interface...");
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setStatusMessage("Signed in! Repwise is synced with your Google Drive.");
      }
    });
  }, []);

  const handleDisconnect = () => {
    disconnectGoogleDrive();
    clearStoredUserProfile();
    setDriveConnected(false);
    setUserProfile(null);
    setStatusMessage("Disconnected Google account.");
  };

  const handleManualPush = async () => {
    setIsSyncing(true);
    const success = await pushLatestToDrive();
    setIsSyncing(false);
    if (success) {
      setStatusMessage("Latest data successfully saved to Google Drive.");
    } else {
      setStatusMessage("Sync failed. Check your network connection.");
    }
  };

  const handleManualPull = async () => {
    if (!confirm("This will replace current local entries with the latest Drive backup. Proceed?")) {
      return;
    }
    setIsSyncing(true);
    const success = await pullLatestFromDrive();
    setIsSyncing(false);
    if (success) {
      setStatusMessage("Data restored from Drive! Reloading...");
      setTimeout(() => window.location.reload(), 1200);
    } else {
      setStatusMessage("Restore failed or no backup exists yet.");
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
    <div className="space-y-6 pb-28">
      <header className="pt-2">
        <h1 className="text-xl font-bold tracking-tight text-white">Data & Settings</h1>
        <p className="text-xs text-zinc-400">Manage app installation, cloud sync, and local backups</p>
      </header>

      {statusMessage && (
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-white shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* INSTALL APP ON HOME SCREEN */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-white" />
            <h2 className="text-xs uppercase font-semibold text-zinc-300">
              Install Repwise App
            </h2>
          </div>
          {isInstalled && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" /> Installed
            </span>
          )}
        </div>

        {isInstalled ? (
          <p className="text-xs text-zinc-400 leading-relaxed">
            Repwise is currently installed and running as a standalone app on your device.
          </p>
        ) : canInstall ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Install Repwise to your home screen for instant offline gym access, faster navigation, and a native app display.
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
              <li>Tap the <span className="text-white font-medium">Share</span> button at the bottom of Safari.</li>
              <li>Scroll down and tap <span className="text-white font-medium">Add to Home Screen</span>.</li>
              <li>Tap <span className="text-white font-medium">Add</span> in the top-right corner.</li>
            </ol>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Open your browser menu (the three dots in the top right corner) and tap <span className="text-white font-medium">Install app</span> or <span className="text-white font-medium">Add to Home screen</span>.
            </p>
          </div>
        )}
      </div>

      {/* GOOGLE DRIVE SYNC CARD */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-white" />
            <h2 className="text-xs uppercase font-semibold text-zinc-300">
              Cloud Storage (Google Drive)
            </h2>
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
              Connect your Google account to automatically preserve your routines and workouts directly inside your private Google Drive app storage.
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
                disabled={isSyncing}
                onClick={handleManualPush}
                className="py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                Push to Drive
              </button>
              <button
                disabled={isSyncing}
                onClick={handleManualPull}
                className="py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
              >
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
    </div>
  );
}
