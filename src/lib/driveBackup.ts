// src/lib/driveBackup.ts
import { db } from "@/db/database";
import { exportDatabaseToJSON, importDatabaseFromJSON } from "./jsonBackup";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";

let cachedToken: string | null = null;

export async function requestDriveAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !(window as any).google) {
      return reject(new Error("Google Identity SDK not loaded yet. Check internet connection."));
    }

    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response: any) => {
          if (response.error) {
            return reject(new Error(response.error));
          }
          cachedToken = response.access_token;
          await db.settings.update("current", {
            googleDriveLinked: true,
            lastBackupAt: Date.now(),
          });
          resolve(cachedToken!);
        },
      });

      client.requestAccessToken({ prompt: "consent" });
    } catch (err: any) {
      reject(err);
    }
  });
}

export async function uploadBackupToDrive(): Promise<boolean> {
  if (!cachedToken) {
    await requestDriveAuth();
  }
  if (!cachedToken) throw new Error("Google authorization required.");

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
    headers: { Authorization: `Bearer ${cachedToken}` },
    body: form,
  });

  if (res.ok) {
    await db.settings.update("current", { lastBackupAt: Date.now() });
  }
  return res.ok;
}

export async function restoreLatestFromDrive(): Promise<boolean> {
  if (!cachedToken) {
    await requestDriveAuth();
  }
  if (!cachedToken) throw new Error("Google authorization required.");

  const searchRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='repwise_backup.json'&orderBy=modifiedTime desc",
    {
      headers: { Authorization: `Bearer ${cachedToken}` },
    }
  );

  const searchData = await searchRes.json();
  if (!searchData.files || searchData.files.length === 0) {
    throw new Error("No existing backup file found in Google Drive.");
  }

  const fileId = searchData.files[0].id;
  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${cachedToken}` },
  });

  const jsonText = await fileRes.text();
  return importDatabaseFromJSON(jsonText);
}
