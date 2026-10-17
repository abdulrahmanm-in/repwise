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

  const loadGoogleClient = () => {
    if (window.google && window.google.accounts?.oauth2) {
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
      return;
    }

    const script = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (!script) {
      const googleScript = document.createElement("script");
      googleScript.src = "https://accounts.google.com/gsi/client";
      googleScript.async = true;
      googleScript.defer = true;
      googleScript.onload = () => {
        if (window.google && window.google.accounts?.oauth2) {
          loadGoogleClient();
        }
      };
      document.head.appendChild(googleScript);
    }
  };

  loadGoogleClient();
}

export async function requestSilentTokenRefresh(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!tokenClient && typeof window !== "undefined" && window.google) {
      initGoogleAuth(activeSuccessCallback || (() => {}));
    }

    if (!tokenClient) {
      resolve(null);
      return;
    }

    tokenClient.callback = (tokenResponse: any) => {
      if (tokenResponse?.access_token) {
        setStoredAccessToken(tokenResponse.access_token);
        resolve(tokenResponse.access_token);
      } else {
        resolve(null);
      }
    };

    try {
      tokenClient.requestAccessToken({ prompt: "none" });
    } catch {
      resolve(null);
    }
  });
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