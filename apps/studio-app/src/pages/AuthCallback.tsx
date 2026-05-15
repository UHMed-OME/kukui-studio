import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseAuthCallback } from "../sketchfab/client.js";
import { saveSketchfabToken } from "../sketchfab/settings.js";
import {
  __SKETCHFAB_STATE_KEY,
  __SKETCHFAB_RETURN_TO_KEY,
} from "../sketchfab/useSketchfabAuth.js";

type Status =
  | { kind: "processing" }
  | { kind: "error"; message: string };

/**
 * Sketchfab Implicit grant callback handler.
 *
 * Sketchfab redirects here with the access token in the URL fragment:
 *   /auth/sketchfab/callback#access_token=...&expires_in=...&state=...
 *
 * We:
 *   1. Parse the fragment.
 *   2. Verify the state nonce matches what we stashed before redirect
 *      (CSRF defence).
 *   3. Save the token via the settings module.
 *   4. Strip the fragment from history (so a back-navigation doesn't
 *      re-parse stale state).
 *   5. Redirect to whatever URL the user was on before signing in.
 */
export function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: "processing" });

  useEffect(() => {
    const result = parseAuthCallback(window.location.hash);
    if (result.kind === "error") {
      setStatus({ kind: "error", message: result.message });
      return;
    }
    const expectedState = sessionStorage.getItem(__SKETCHFAB_STATE_KEY);
    sessionStorage.removeItem(__SKETCHFAB_STATE_KEY);
    if (!expectedState || result.state !== expectedState) {
      setStatus({
        kind: "error",
        message: "State mismatch — possible CSRF. Sign-in aborted.",
      });
      return;
    }
    // Default storage choice: session (more conservative than local).
    // The ConnectionsPane offers a "remember on this device" toggle that
    // re-saves with `storage: "local"` once the user is signed in.
    //
    // Sketchfab usually returns expires_in ~2592000 (30 days) per their
    // Implicit grant docs. If the response is missing or zero — non-spec
    // behaviour, but we've seen it from misconfigured OAuth providers —
    // a literal `Date.now() + 0` would mark the token expired immediately
    // and silently sign the user out after a successful round-trip. Fall
    // back to Sketchfab's documented TTL in that case.
    const SKETCHFAB_DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;
    const ttlSeconds =
      result.expiresInSeconds > 0 ? result.expiresInSeconds : SKETCHFAB_DEFAULT_TTL_SECONDS;
    saveSketchfabToken({
      accessToken: result.accessToken,
      expiresAt: Date.now() + ttlSeconds * 1000,
      scope: result.scope,
      storage: "session",
    });
    // Strip the fragment so it doesn't linger in history / bookmarks.
    window.history.replaceState(null, "", window.location.pathname);
    const returnTo = sessionStorage.getItem(__SKETCHFAB_RETURN_TO_KEY) ?? "/studio";
    sessionStorage.removeItem(__SKETCHFAB_RETURN_TO_KEY);
    navigate(returnTo, { replace: true });
  }, [navigate]);

  if (status.kind === "error") {
    return (
      <div role="alert" style={{ maxWidth: 480, margin: "80px auto", padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>Sketchfab sign-in failed</h1>
        <p>{status.message}</p>
        <p>
          <a href="/studio">Return to Studio</a>
        </p>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" style={{ maxWidth: 480, margin: "80px auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Finishing Sketchfab sign-in…</h1>
      <p>This usually takes less than a second.</p>
    </div>
  );
}
