import { useEffect, useState } from "react";
import type { AISettings } from "../../ai/settings.js";
import { AIPane } from "./AIPane.js";
import { driveEnabled, GOOGLE_APP_ID } from "../../drive/config.js";
import { clearDriveToken, getCachedToken } from "../../drive/auth.js";
import { useSketchfabAuth } from "../../sketchfab/useSketchfabAuth.js";
import { sketchfabEnabled } from "../../sketchfab/config.js";
import {
  clearAllCachedModels,
  cachedModelCount,
} from "../../sketchfab/modelCache.js";
import {
  loadSketchfabToken,
  saveSketchfabToken,
  type SketchfabStorage,
} from "../../sketchfab/settings.js";

/**
 * Settings pane that groups every external connection in one place:
 *   - AI Assist (bring-your-own provider + key)
 *   - Google Drive (OAuth sign-in for import / export)
 *   - <future connectors land here, NOT as their own top-level tab>
 *
 * Each connector is a self-contained section. Order is intentional:
 * AI is the connector with the broadest day-to-day impact (every
 * "Ask AI" call hits it); Drive is opt-in per import / export.
 */
export function ConnectionsPane({
  onAISaved,
}: {
  onAISaved?: (s: AISettings) => void;
}) {
  return (
    <div className="ks-settings-pane ks-connections-pane">
      <section className="ks-connections-section">
        <h3 className="ks-connections-section__title">AI Assist</h3>
        <AIPane onSaved={onAISaved} />
      </section>
      <section className="ks-connections-section">
        <h3 className="ks-connections-section__title">Google Drive</h3>
        <DriveSection />
      </section>
      <section className="ks-connections-section">
        <h3 className="ks-connections-section__title">Sketchfab</h3>
        <SketchfabSection />
      </section>
    </div>
  );
}

/**
 * Google Drive status + sign-out. The OAuth client is configured at
 * deploy time (env vars), so there's no client-side "connect" config
 * here — just status display and a button to drop the in-memory
 * token. Re-auth happens automatically the next time the user clicks
 * Open / Save from Drive.
 */
function DriveSection() {
  // The cached token is in-memory only and module-scoped, so React
  // doesn't auto-refresh status when it changes. Poll on focus so
  // closing/reopening Settings reflects sign-out done elsewhere.
  const [signedIn, setSignedIn] = useState(() => Boolean(getCachedToken()));
  useEffect(() => {
    const refresh = () => setSignedIn(Boolean(getCachedToken()));
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  if (!driveEnabled()) {
    return (
      <p className="ks-dialog__message">
        Drive integration isn't configured for this deployment. The Import / Export
        menus won't show Drive options. Ask your administrator to set the{" "}
        <code className="ks-ai-form__code">VITE_GOOGLE_CLIENT_ID</code>,{" "}
        <code className="ks-ai-form__code">VITE_GOOGLE_API_KEY</code>, and{" "}
        <code className="ks-ai-form__code">VITE_GOOGLE_APP_ID</code> build-time
        variables.
      </p>
    );
  }

  const handleSignOut = () => {
    clearDriveToken();
    setSignedIn(false);
  };

  return (
    <>
      <p className="ks-dialog__message">
        Save Kukui activity JSON to your own Google Drive and open files back
        from it. Kukui requests the <code className="ks-ai-form__code">drive.file</code>{" "}
        scope — the most restrictive option Google offers. We can only touch
        files Kukui itself created or that you explicitly pick through Google's
        file picker; the rest of your Drive stays invisible to us.
      </p>
      <dl className="ks-connections-status">
        <dt>Status</dt>
        <dd>{signedIn ? "Signed in (token cached in memory)" : "Not signed in"}</dd>
        <dt>Scope</dt>
        <dd>drive.file (per-file consent via Picker)</dd>
        {GOOGLE_APP_ID ? (
          <>
            <dt>Project</dt>
            <dd>{GOOGLE_APP_ID}</dd>
          </>
        ) : null}
      </dl>
      <div className="ks-settings-pane__actions">
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
          className="kukui-studio-btn kukui-studio-btn--ghost"
        >
          Manage access on Google →
        </a>
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--ghost"
          onClick={handleSignOut}
          disabled={!signedIn}
          title={
            signedIn
              ? "Forget the cached token. Next Drive action re-prompts for consent."
              : "Not currently signed in."
          }
        >
          Sign out of Drive
        </button>
      </div>
    </>
  );
}

/**
 * Sketchfab status + sign-in / sign-out + storage preference + cache clear.
 * The OAuth client is configured at deploy time (VITE_SKETCHFAB_CLIENT_ID).
 * When that env var is absent the integration is considered disabled and we
 * surface a friendly explanation rather than a broken UI.
 */
function SketchfabSection() {
  const { status, token, signIn, signOut } = useSketchfabAuth();
  const [cacheCount, setCacheCount] = useState<number | null>(null);
  const [storage, setStorage] = useState<SketchfabStorage>(token?.storage ?? "session");

  useEffect(() => {
    cachedModelCount().then(setCacheCount).catch(() => setCacheCount(null));
  }, [token]);

  useEffect(() => {
    setStorage(token?.storage ?? "session");
  }, [token]);

  if (status === "disabled") {
    return (
      <p className="ks-dialog__message">
        Sketchfab integration isn't configured for this deployment. Ask
        your administrator to set the{" "}
        <code className="ks-ai-form__code">VITE_SKETCHFAB_CLIENT_ID</code>{" "}
        build-time variable.
      </p>
    );
  }

  const handleStorageChange = (next: SketchfabStorage) => {
    setStorage(next);
    const current = loadSketchfabToken();
    if (current) {
      saveSketchfabToken({ ...current, storage: next });
    }
  };

  const handleClearCache = async () => {
    await clearAllCachedModels();
    setCacheCount(0);
  };

  return (
    <>
      <p className="ks-dialog__message">
        Sign in to Sketchfab to import your Creative Commons–licensed 3D
        models into 3D Hotspot activities. Kukui only requests the
        minimum-scope read token; we never upload anything to Sketchfab
        and never see your private library.
      </p>
      <dl className="ks-connections-status">
        <dt>Status</dt>
        <dd>
          {status === "signed-in"
            ? `Signed in (token expires ${token ? new Date(token.expiresAt).toLocaleDateString() : "—"})`
            : "Not signed in"}
        </dd>
        <dt>Cached models</dt>
        <dd>{cacheCount ?? "—"}</dd>
      </dl>
      {status === "signed-in" ? (
        <fieldset className="ks-connections-fieldset">
          <legend>Remember sign-in</legend>
          <label>
            <input
              type="radio"
              name="sketchfab-storage"
              value="session"
              checked={storage === "session"}
              onChange={() => handleStorageChange("session")}
            />{" "}
            This session only (cleared on tab close)
          </label>
          <label>
            <input
              type="radio"
              name="sketchfab-storage"
              value="local"
              checked={storage === "local"}
              onChange={() => handleStorageChange("local")}
            />{" "}
            On this device (persists until token expires or you sign out)
          </label>
        </fieldset>
      ) : null}
      <div className="ks-settings-pane__actions">
        {status === "signed-in" ? (
          <>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost"
              onClick={handleClearCache}
              disabled={(cacheCount ?? 0) === 0}
              title="Drop every cached .glb body. Models will re-download on next use."
            >
              Clear model cache
            </button>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost"
              onClick={signOut}
            >
              Sign out of Sketchfab
            </button>
          </>
        ) : (
          <button
            type="button"
            className="kukui-studio-btn kukui-studio-btn--primary"
            onClick={() => signIn()}
            disabled={!sketchfabEnabled()}
          >
            Sign in to Sketchfab
          </button>
        )}
      </div>
      {import.meta.env.DEV && status !== "signed-in" ? (
        <details className="ks-connections-dev-affordance" style={{ marginTop: 12 }}>
          <summary>Dev only — paste a token manually</summary>
          <p className="ks-dialog__message">
            Local dev can't complete a real OAuth flow until Sketchfab
            adds <code>http://localhost:5174/auth/sketchfab/callback</code> as
            a second redirect URI. In the meantime, generate a token
            against production (sign in at kukuistudio.com once, copy
            the token from sessionStorage) and paste it here to test the
            signed-in code paths without leaving localhost.
          </p>
          <DevPasteToken />
        </details>
      ) : null}
    </>
  );
}

function DevPasteToken() {
  const [value, setValue] = useState("");
  const [days, setDays] = useState("30");

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const dayCount = Math.max(1, Math.min(60, Number.parseInt(days, 10) || 30));
    saveSketchfabToken({
      accessToken: trimmed,
      expiresAt: Date.now() + dayCount * 24 * 60 * 60 * 1000,
      scope: "read",
      storage: "session",
    });
    setValue("");
    window.dispatchEvent(new Event("storage")); // nudge useSketchfabAuth
  };

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
      <label>
        Access token
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          style={{ display: "block", width: "100%", fontFamily: "monospace" }}
        />
      </label>
      <label>
        Expires in (days)
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          min={1}
          max={60}
          style={{ width: 80 }}
        />
      </label>
      <button
        type="button"
        className="kukui-studio-btn kukui-studio-btn--primary"
        onClick={handleSave}
        disabled={!value.trim()}
      >
        Save dev token
      </button>
    </div>
  );
}
