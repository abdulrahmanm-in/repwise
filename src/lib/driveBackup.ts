// src/lib/driveBackup.ts
import { db } from "@/db/database";
import { exportDatabaseToJSON, importDatabaseFromJSON } from "./jsonBackup";

declare global {
  interface Window {
    google?: any;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";

let cachedToken: string | null = null;
let tokenClient: any = null;

// Return cached memory token or fallback to local storage
export function getStoredAccessToken(): string | null {
  if (cachedToken) return cachedToken;
  if (typeof window !== "undefined") {
    return localStorage.getItem("gdrive_access_token");
  }
  return null;
}

// Store token locally and in memory
export function setStoredAccessToken(token: string | null) {
  cachedToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("gdrive_access_token", token);
    } else {
      localStorage.removeItem("gdrive_access_token");
    }
  }
}

// Initializer expected by page.tsx and driveSync.ts
export function initGoogleAuth(onSuccess?: (token: string) => void) {
  if (typeof window === "undefined" || !window.google || !CLIENT_ID) return;

  try {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (response: any) => {
        if (response.error) {
          console.error("Google Auth error:", response.error);
          return;
        }
        setStoredAccessToken(response.access_token);
        await db.settings.update("current", {
          googleDriveLinked: true,
          lastBackupAt: Date.now(),
        });
        if (onSuccess) {
          onSuccess(response.access_token);
        }
      },
    });
  } catch (err) {
    console.warn("Failed to initialize Google Auth:", err);
  }
}

// Sign-in trigger
export async function requestDriveAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.google) {
      return reject(new Error("Google Identity SDK not loaded yet."));
    }

    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response: any) => {
          if (response.error) {
            return reject(new Error(response.error));
          }
          setStoredAccessToken(response.access_token);
          await db.settings.update("current", {
            googleDriveLinked: true,
            lastBackupAt: Date.now(),
          });
          resolve(response.access_token);
        },
      });

      tokenClient.requestAccessToken({ prompt: "consent" });
    } catch (err: any) {
      reject(err);
    }
  });
}

// Disconnect helper expected by driveSync.ts & dashboard
export async function disconnectGoogleDrive(): Promise<void> {
  const token = getStoredAccessToken();
  if (token && typeof window !== "undefined" && window.google) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {});
    } catch (e) {
      console.warn("Failed to revoke token:", e);
    }
  }

  setStoredAccessToken(null);
  await db.settings.update("current", {
    googleDriveLinked: false,
  });
}

// Backup database to hidden appDataFolder
export async function uploadBackupToDrive(): Promise<boolean> {
  let token = getStoredAccessToken();
  if (!token) {
    token = await requestDriveAuth();
  }
  if (!token) throw new Error("Google authorization required.");

  const backupData = await exportDatabaseToJSON();
  const fileContent = new Blob([backupData], { type: "application/json" });
  const metadata = {
    name: "repwise_backup.json",
    parents: ["appDataFolder"],
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", fileContent);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (res.ok) {
    await db.settings.update("current", { lastBackupAt: Date.now() });
  }
  return res.ok;
}

// Restore database from appDataFolder
export async function restoreLatestFromDrive(): Promise<boolean> {
  let token = getStoredAccessToken();
  if (!token) {
    token = await requestDriveAuth();
  }
  if (!token) throw new Error("Google authorization required.");

  const searchRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='repwise_backup.json'&orderBy=modifiedTime desc",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const searchData = await searchRes.json();
  if (!searchData.files || searchData.files.length === 0) {
    throw new Error("No existing backup file found in Google Drive.");
  }

  const fileId = searchData.files[0].id;
  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const jsonText = await fileRes.text();
  return importDatabaseFromJSON(jsonText);
}
