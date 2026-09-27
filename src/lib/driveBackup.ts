// src/lib/driveBackup.ts
import { exportDatabaseToJSON, importDatabaseFromJSON } from "./jsonBackup";

declare global {
  interface Window {
    google?: any;
  }
}
declare const google: any;

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const SCOPES =
  "openid email profile https://www.googleapis.com/auth/drive.appdata";
const STORAGE_KEY_TOKEN = "repwise_gdrive_token";
const BACKUP_FILENAME = "repwise_db.json";

let tokenClient: any = null;

/**
 * Returns the currently cached OAuth access token from localStorage
 */
export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

/**
 * Initializes Google Identity Services token client
 */
export function initGoogleAuth(onSuccess: (token: string) => void) {
  if (typeof window === "undefined" || !window.google || !CLIENT_ID) return;

  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
          localStorage.setItem(STORAGE_KEY_TOKEN, tokenResponse.access_token);
          onSuccess(tokenResponse.access_token);
        }
      },
    });
  } catch (err) {
    console.warn("Google Drive Auth initialization skipped:", err);
  }
}

/**
 * Prompts user with Google OAuth consent dialog
 */
export function requestDriveAuth() {
  if (!CLIENT_ID) {
    alert(
      "Missing Google Client ID in .env.local.\nPlease add NEXT_PUBLIC_GOOGLE_CLIENT_ID to connect Google Drive."
    );
    return;
  }

  if (!tokenClient && typeof window !== "undefined" && window.google) {
    initGoogleAuth(() => {});
  }

  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    alert("Google Identity script is still loading. Please try again in a moment.");
  }
}

/**
 * Clears the stored OAuth token on logout
 */
export function disconnectGoogleDrive() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  }
}

/**
 * Uploads or overwrites the database snapshot to the user's hidden appDataFolder
 */
export async function uploadBackupToDrive(): Promise<boolean> {
  const token = getStoredAccessToken();
  if (!token) throw new Error("Google Drive access token missing. Please connect first.");

  const backupData = await exportDatabaseToJSON();
  const fileContent = new Blob([backupData], { type: "application/json" });

  // 1. Check if backup already exists to overwrite rather than duplicate
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (searchRes.status === 401) {
    disconnectGoogleDrive();
    throw new Error("Session expired. Please reconnect your Google Drive.");
  }

  const searchData = await searchRes.json();
  const existingFile = searchData.files?.[0];

  if (existingFile) {
    // Update existing file content via PATCH
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
    // Create new file inside appDataFolder via multipart POST
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
}

/**
 * Downloads the latest database snapshot from the user's hidden appDataFolder and hydrates Dexie
 */
export async function restoreLatestFromDrive(): Promise<boolean> {
  const token = getStoredAccessToken();
  if (!token) throw new Error("Google Drive access token missing. Please connect first.");

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&orderBy=modifiedTime desc`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (searchRes.status === 401) {
    disconnectGoogleDrive();
    throw new Error("Session expired. Please reconnect your Google Drive.");
  }

  const searchData = await searchRes.json();
  if (!searchData.files || searchData.files.length === 0) {
    throw new Error("No existing backup file discovered on Google Drive.");
  }

  const fileId = searchData.files[0].id;
  const fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!fileRes.ok) throw new Error("Failed to download backup file content.");

  const jsonText = await fileRes.text();
  return importDatabaseFromJSON(jsonText);
}