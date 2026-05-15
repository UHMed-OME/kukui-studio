import { useCallback, useEffect, useState } from "react";
import { sketchfabEnabled, sketchfabRedirectUri, SKETCHFAB_CLIENT_ID } from "./config.js";
import { buildAuthorizeUrl } from "./client.js";
import {
  clearSketchfabToken,
  loadSketchfabToken,
  type SketchfabToken,
} from "./settings.js";

export type SketchfabAuthStatus =
  | "disabled" // SKETCHFAB_CLIENT_ID not set (env var missing)
  | "signed-out"
  | "signed-in";

export type UseSketchfabAuth = {
  status: SketchfabAuthStatus;
  token: SketchfabToken | null;
  /** Kick off the OAuth flow. `returnTo` is where to land after callback. */
  signIn: (returnTo?: string) => void;
  signOut: () => void;
};

const STATE_KEY = "kukui:sketchfab:oauth-state";
const RETURN_TO_KEY = "kukui:sketchfab:return-to";

function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useSketchfabAuth(): UseSketchfabAuth {
  const [token, setToken] = useState<SketchfabToken | null>(() => loadSketchfabToken());

  // Refresh when another tab signs in/out — storage event fires
  // cross-tab on localStorage writes, and on focus catches the within-
  // tab callback round-trip after `/auth/sketchfab/callback` saves.
  useEffect(() => {
    const refresh = () => setToken(loadSketchfabToken());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const signIn = useCallback((returnTo?: string) => {
    if (!sketchfabEnabled()) return;
    const state = generateState();
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_TO_KEY, returnTo ?? window.location.pathname + window.location.search);
    window.location.assign(
      buildAuthorizeUrl({
        clientId: SKETCHFAB_CLIENT_ID,
        redirectUri: sketchfabRedirectUri(),
        state,
      }),
    );
  }, []);

  const signOut = useCallback(() => {
    clearSketchfabToken();
    setToken(null);
  }, []);

  const status: SketchfabAuthStatus = !sketchfabEnabled()
    ? "disabled"
    : token
    ? "signed-in"
    : "signed-out";

  return { status, token, signIn, signOut };
}

export { STATE_KEY as __SKETCHFAB_STATE_KEY, RETURN_TO_KEY as __SKETCHFAB_RETURN_TO_KEY };
