// src/lib/driveSync.ts
import { db } from "@/db/database";
import { exportDatabaseToJSON, importDatabaseFromJSON } from "./jsonBackup";
import { getStoredAccessToken, disconnectGoogleDrive } from "./driveBackup";

const BACKUP_FILENAME = "repwise_db.json";
const PROFILE_STORAGE_KEY = "repwise_user_profile";

let syncTimeout: NodeJS.Timeout | null = null;

export interface GoogleUserProfile {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture: string;
  email: string;
  email_verified: boolean;
}

/**
 * Reads locally cached user profile
 */
export function getStoredUserProfile(): GoogleUserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Fetches identity from Google and saves to localStorage
 */
export async function fetchAndStoreGoogleProfile(
  token: string
): Promise<GoogleUserProfile | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) disconnectGoogleDrive();
      return null;
    }
    const profile: GoogleUserProfile = await res.json();
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    return profile;
  } catch (err) {
    console.error("Error fetching Google profile:", err);
    return null;
  }
}

/**
 * Removes cached user profile
 */
export function clearStoredUserProfile() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  }
}

/**
 * Completely logs out user: wipes OAuth tokens, clears local profile,
 * wipes database tables (optional for security), and reloads to the login screen.
 */
export async function performFullLogout(clearLocalDatabase: boolean = true) {
  disconnectGoogleDrive();
  clearStoredUserProfile();
  if (typeof window !== "undefined") {
    localStorage.removeItem("repwise_guest_mode");
  }

  if (clearLocalDatabase) {
    await Promise.all([
      db.workouts.clear(),
      db.workoutExercises.clear(),
      db.sets.clear(),
      db.routines.clear(),
      db.routineItems.clear(),
      db.bodyWeights.clear(),
    ]);
  }

  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}

/**
 * Searches and downloads the latest snapshot from the user's hidden Google Drive appDataFolder
 */
export async function pullLatestFromDrive(): Promise<boolean> {
  const token = getStoredAccessToken();
  if (!token) return false;

  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&orderBy=modifiedTime desc`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (searchRes.status === 401) {
      disconnectGoogleDrive();
      clearStoredUserProfile();
      return false;
    }

    const searchData = await searchRes.json();
    if (!searchData.files || searchData.files.length === 0) {
      await pushLatestToDrive();
      return true;
    }

    const fileId = searchData.files[0].id;
    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!fileRes.ok) return false;
    const rawJson = await fileRes.text();
    return await importDatabaseFromJSON(rawJson);
  } catch (error) {
    console.error("Pull from Drive failed:", error);
    return false;
  }
}

/**
 * Overwrites or creates the latest database snapshot in Drive
 */
export async function pushLatestToDrive(): Promise<boolean> {
  const token = getStoredAccessToken();
  if (!token) return false;

  try {
    const backupData = await exportDatabaseToJSON();
    const fileContent = new Blob([backupData], { type: "application/json" });

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (searchRes.status === 401) {
      disconnectGoogleDrive();
      clearStoredUserProfile();
      return false;
    }

    const searchData = await searchRes.json();
    const existingFile = searchData.files?.[0];

    if (existingFile) {
      const updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: fileContent,
        }
      );
      return updateRes.ok;
    } else {
      const metadata = {
        name: BACKUP_FILENAME,
        parents: ["appDataFolder"],
      };
      const form = new FormData();
      form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      form.append("file", fileContent);

      const createRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }
      );
      return createRes.ok;
    }
  } catch (error) {
    console.error("Push to Drive failed:", error);
    return false;
  }
}

/**
 * Debounced auto-sync trigger: executes after a short delay (default 1.5s).
 * Prevents exhausting Google Drive API quotas during active typing while
 * guaranteeing every change gets backed up automatically.
 */
export function triggerAutoSync(delayMs: number = 1500) {
  const token = getStoredAccessToken();
  if (!token) return;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    pushLatestToDrive().catch((err) =>
      console.warn("Auto-sync background upload skipped:", err)
    );
  }, delayMs);
}