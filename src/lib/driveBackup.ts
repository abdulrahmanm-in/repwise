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

export function requestDriveAuth() {
  if (!CLIENT_ID) {
    alert("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local.");
    return;
  }

  if (!tokenClient && typeof window !== "undefined" && window.google) {
    initGoogleAuth(activeSuccessCallback || (() => {}));
  }

  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: "" });
  } else {
    alert("Google Identity service is still loading. Please tap again in a moment.");
  }
}

/**
 * Permanently removes all backup files from the user's hidden Google Drive appDataFolder
 */
export async function deleteDriveAppDataBackup(): Promise<boolean> {
  const token = getStoredAccessToken();
  if (!token) return true;

  try {
    const searchRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!searchRes.ok) return false;

    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      await Promise.all(
        data.files.map((file: { id: string }) =>
          fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );
    }
    return true;
  } catch (e) {
    console.error("Failed to delete drive appdata files:", e);
    return false;
  }
}

export function disconnectGoogleDrive() {
  const token = getStoredAccessToken();

  if (token && typeof window !== "undefined" && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {});
    } catch (e) {
      console.warn("Could not revoke token remotely:", e);
    }
  }

  setStoredAccessToken(null);
}