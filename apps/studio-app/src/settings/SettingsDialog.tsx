import { useEffect, useRef, useState } from "react";
import type { AISettings } from "../ai/settings.js";
import { AIPane } from "./panes/AIPane.js";
import { AboutPane } from "./panes/AboutPane.js";
import { AppearancePane } from "./panes/AppearancePane.js";
import "./SettingsDialog.css";

/**
 * Privacy is intentionally NOT a pane here — long prose-y content
 * doesn't fit comfortably in the dialog's narrow column. The footer's
 * "Privacy & data" link routes to the standalone `/privacy` page
 * instead.
 */
export type SettingsPane = "appearance" | "ai" | "about";

const PANES: Array<{ id: SettingsPane; label: string }> = [
  { id: "appearance", label: "Appearance" },
  { id: "ai", label: "AI Assist" },
  { id: "about", label: "About" },
];

/**
 * Multi-pane settings dialog. Replaces the single-purpose AISettingsDialog
 * with a tabbed shell that scales as new settings (theme, language,
 * accessibility) come online. Each pane is a self-contained component
 * under ./panes/.
 */
export function SettingsDialog({
  open,
  initialPane = "appearance",
  onClose,
  onAISaved,
  onResetAll,
}: {
  open: boolean;
  initialPane?: SettingsPane;
  onClose: () => void;
  onAISaved?: (s: AISettings) => void;
  onResetAll?: () => void;
}) {
  const [pane, setPane] = useState<SettingsPane>(initialPane);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setPane(initialPane);
  }, [open, initialPane]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="ks-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ks-settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ks-dialog ks-settings-dialog" ref={dialogRef}>
        <header className="ks-settings-dialog__header">
          <h2 id="ks-settings-title" className="ks-dialog__title">
            Settings
          </h2>
        </header>
        <div className="ks-settings-dialog__body">
          <nav
            className="ks-settings-dialog__nav"
            aria-label="Settings sections"
          >
            {PANES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={[
                  "ks-settings-dialog__tab",
                  pane === id ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setPane(id)}
                aria-current={pane === id ? "page" : undefined}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="ks-settings-dialog__pane">
            {pane === "appearance" ? <AppearancePane /> : null}
            {pane === "ai" ? <AIPane onSaved={onAISaved} /> : null}
            {pane === "about" ? <AboutPane /> : null}
          </div>
        </div>
        <footer className="ks-settings-dialog__footer">
          {onResetAll ? (
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--danger kukui-studio-btn--sm"
              onClick={onResetAll}
            >
              Reset all
            </button>
          ) : null}
          <button
            type="button"
            className="kukui-studio-btn kukui-studio-btn--ghost"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
