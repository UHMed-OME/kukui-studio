import { DRIVE_SCOPE, GOOGLE_CLIENT_ID } from "./config.js";

/**
 * Google Identity Services token client.
 *
 * Loads `accounts.google.com/gsi/client` on demand, requests a Drive
 * access token via the OAuth implicit flow, and hands it back to the
 * caller. The token is in-memory only (no refresh tokens in the
 * browser) and expires after ~1 hour. Subsequent operations after
 * expiry trigger a silent re-auth.
 *
 * We deliberately don't persist the token: the OAuth Bearer is
 * powerful enough that storing it in localStorage / sessionStorage
 * would be an XSS pivot. Re-prompting once an hour is the right
 * trade-off for a no-backend app.
 */

const GIS_SCRIPT = "https://accounts.google.com/gsi/client";

let gisScriptPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisScriptPromise = null;
      reject(new Error("Failed to load Google Identity Services"));
    };
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

/** In-memory token cache. Cleared on page reload by design. */
let cachedToken: { token: string; expiresAt: number } | null = null;

const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 min, leaving headroom under Google's 1 h.

export function getCachedToken(): string | null {
  if (!cachedToken) return null;
  if (Date.now() >= cachedToken.expiresAt) {
    cachedToken = null;
    return null;
  }
  return cachedToken.token;
}

/**
 * Request a Drive access token, prompting the user for consent on first
 * use. Subsequent calls within the TTL return the cached token without
 * a prompt. On token expiry, re-prompts silently when possible.
 *
 * Always rejects with a human-readable Error if the user denied consent
 * or the popup was blocked — callers display the message to the user.
 */
export function requestDriveToken(): Promise<string> {
  const existing = getCachedToken();
  if (existing) return Promise.resolve(existing);

  if (!GOOGLE_CLIENT_ID) {
    return Promise.reject(new Error("Drive integration not configured."));
  }

  return loadGis().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const oauth = window.google?.accounts?.oauth2;
        if (!oauth) {
          reject(new Error("Google sign-in failed to load."));
          return;
        }
        const client = oauth.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: DRIVE_SCOPE,
          callback: (response) => {
            if (response.error) {
              reject(new Error(`Google sign-in error: ${response.error}`));
              return;
            }
            if (!response.access_token) {
              reject(new Error("Google sign-in returned no token."));
              return;
            }
            cachedToken = {
              token: response.access_token,
              expiresAt: Date.now() + TOKEN_TTL_MS,
            };
            resolve(response.access_token);
          },
          error_callback: (err) => {
            reject(
              new Error(
                err.message ?? "Google sign-in was cancelled or failed.",
              ),
            );
          },
        });
        // Prompt the user — opens the Google popup. On subsequent
        // requests within the session, Google may grant silently
        // without showing the popup.
        client.requestAccessToken({ prompt: "" });
      }),
  );
}

/** Drop the in-memory token. Used by a "Sign out" affordance. */
export function clearDriveToken(): void {
  cachedToken = null;
}
