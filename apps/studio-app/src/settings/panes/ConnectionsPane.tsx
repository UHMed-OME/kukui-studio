import { useEffect, useState } from "react";
import type { AISettings } from "../../ai/settings.js";
import { AIPane } from "./AIPane.js";
import { driveEnabled, GOOGLE_APP_ID } from "../../drive/config.js";
import { clearDriveToken, getCachedToken } from "../../drive/auth.js";

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
        <div>
          <dt>Status</dt>
          <dd>{signedIn ? "Signed in (token cached in memory)" : "Not signed in"}</dd>
        </div>
        <div>
          <dt>Scope</dt>
          <dd>drive.file (per-file consent via Picker)</dd>
        </div>
        {GOOGLE_APP_ID ? (
          <div>
            <dt>Project</dt>
            <dd>{GOOGLE_APP_ID}</dd>
          </div>
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
