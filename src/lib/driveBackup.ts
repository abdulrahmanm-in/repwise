// src/lib/driveBackup.ts
import { exportDatabaseToJSON, importDatabaseFromJSON } from "./jsonBackup";

declare global {
  interface Window {
    google?: any;
  }
}
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const SCOPES =
  "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile";

let tokenClient: any = null;
let activeSuccessCallback: ((token: string) => void) | null = null;

/**
 * Access token persistence helpers
 */
export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("repwise_google_token");
}

export function setStoredAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("repwise_google_token", token);
  } else {
    localStorage.removeItem("repwise_google_token");
  }
}

/**
 * Initialize Google Identity Services OAuth Token Client
 */
export function initGoogleAuth(onSuccess: (token: string) => void) {
  if (typeof window === "undefined") return;
  activeSuccessCallback = onSuccess;

  const googleObj = window.google;
  if (!googleObj || !CLIENT_ID) return;

  try {
    tokenClient = googleObj.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
          setStoredAccessToken(tokenResponse.access_token);
          if (activeSuccessCallback) {
            activeSuccessCallback(tokenResponse.access_token);
          }
        }
      },
      error_callback: (error: any) => {
        console.warn("Google OAuth popup closed or error:", error);
      },
    });
  } catch (err) {
    console.warn("Failed to initialize Google token client:", err);
  }
}

/**
 * Trigger the Google OAuth consent popup
 */
export function requestDriveAuth() {
  if (!CLIENT_ID) {
    alert(
      "Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local. Continuing in local guest mode."
    );
    return;
  }

  if (!tokenClient && typeof window !== "undefined" && window.google) {
    initGoogleAuth(activeSuccessCallback || (() => {}));
  }

  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: "" });
  } else {
    alert(
      "Google Identity service is still loading. Please tap again in a moment."
    );
  }
}

/**
 * Upload an encrypted or clean JSON database snapshot directly to the isolated appDataFolder
 */
export async function uploadBackupToDrive(): Promise<boolean> {
  const token = getStoredAccessToken();
  if (!token) {
    throw new Error("No active Google account found. Sign in first.");
  }

  const backupData = await exportDatabaseToJSON();
  const fileContent = new Blob([backupData], { type: "application/json" });

  // First, verify if an existing backup file is present in appDataFolder
  const searchRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='repwise_backup.json'&fields=files(id,name)",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!searchRes.ok) {
    if (searchRes.status === 401) {
      setStoredAccessToken(null);
      throw new Error("Session expired. Please reconnect your Google account.");
    }
    throw new Error("Failed to check existing cloud backups.");
  }

  const searchData = await searchRes.json();
  const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

  if (existingFile) {
    // Overwrite the existing backup file
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
    // Create new backup file in appDataFolder
    const metadata = {
      name: "repwise_backup.json",
      parents: ["appDataFolder"],
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", fileContent);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );
    return uploadRes.ok;
  }
}

/**
 * Fetch and restore the newest backup file from the appDataFolder
 */
export async function restoreLatestFromDrive(): Promise<boolean> {
  const token = getStoredAccessToken();
  if (!token) {
    throw new Error("No active Google account found. Sign in first.");
  }

  const searchRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='repwise_backup.json'&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!searchRes.ok) {
    if (searchRes.status === 401) {
      setStoredAccessToken(null);
      throw new Error("Session expired. Please reconnect your Google account.");
    }
    throw new Error("Failed to access cloud backups.");
  }

  const searchData = await searchRes.json();
  if (!searchData.files || searchData.files.length === 0) {
    throw new Error("No existing backup file found on Google Drive.");
  }

  const fileId = searchData.files[0].id;
  const fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!fileRes.ok) {
    throw new Error("Failed to download cloud backup file.");
  }

  const jsonText = await fileRes.text();
  return importDatabaseFromJSON(jsonText);
}

/**
 * Revokes Google session token and purges credentials from local storage
 */
export function disconnectGoogleDrive() {
  const token = getStoredAccessToken();

  if (token && typeof window !== "undefined" && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {
        // Token revoked on Google's servers
      });
    } catch (e) {
      console.warn("Could not revoke token remotely:", e);
    }
  }

  setStoredAccessToken(null);
}