import { useEffect, useMemo, useRef, useState } from "react";
import {
  type AISettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  clearSettings,
  maskKey,
} from "./ai/settings.js";
import {
  PRESETS,
  findPreset,
  presetForBaseUrl,
  type ProviderPresetId,
} from "./ai/presets.js";

/**
 * Bring-your-own-key dialog for the AI editor.
 *
 * - Provider preset dropdown pre-fills base URL + model.
 * - Base URL becomes read-only when a non-Custom preset is picked.
 * - API key uses `<input type="password">`; once saved the dialog shows
 *   only the last 4 chars on reopen.
 * - Storage toggle: persistent (localStorage) vs this-session-only
 *   (sessionStorage).
 * - Clear All wipes the slot in *both* storages so a stale key can't hide.
 *
 * Closes on Escape, restores focus on close. Internal focus trap is
 * deliberately light-touch — the dialog has 6+ tabbable fields, so
 * cycling between Cancel/Confirm (like ConfirmDialog) would be hostile.
 */
export function AISettingsDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (s: AISettings) => void;
}) {
  // Local working copy — we don't mutate the storage until the user
  // clicks Save, so Cancel/Escape leave whatever was there before alone.
  const [draft, setDraft] = useState<AISettings>(DEFAULT_SETTINGS);
  const [presetId, setPresetId] = useState<ProviderPresetId>("custom");
  const [keyInput, setKeyInput] = useState("");
  /** True once the user has typed in the key field. Until then we render
   * a placeholder showing the last 4 chars of the saved key. */
  const [keyDirty, setKeyDirty] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  // (Re)hydrate every time the dialog opens — picks up changes from
  // outside (e.g. a "clear all" from another tab).
  useEffect(() => {
    if (!open) return;
    const loaded = loadSettings();
    setDraft(loaded);
    setPresetId(loaded.baseUrl ? presetForBaseUrl(loaded.baseUrl) : "custom");
    setKeyInput("");
    setKeyDirty(false);
    // Focus the first field once layout settles.
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }, [open]);

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

  const activePreset = useMemo(() => findPreset(presetId), [presetId]);

  if (!open) return null;

  const pickPreset = (id: ProviderPresetId) => {
    setPresetId(id);
    const p = findPreset(id);
    if (!p) return;
    // Custom keeps whatever was already in the draft; everything else
    // overwrites baseUrl + model with the preset's defaults (user can
    // still override model after).
    setDraft((d) => ({
      ...d,
      baseUrl: p.id === "custom" ? d.baseUrl : p.baseUrl,
      model: p.id === "custom" || !p.model ? d.model || p.model : p.model,
    }));
  };

  const handleSave = () => {
    const next: AISettings = {
      ...draft,
      apiKey: keyDirty ? keyInput.trim() : draft.apiKey,
    };
    saveSettings(next);
    onSaved?.(next);
    onClose();
  };

  const handleClearAll = () => {
    clearSettings();
    setDraft(DEFAULT_SETTINGS);
    setPresetId("custom");
    setKeyInput("");
    setKeyDirty(false);
    onSaved?.(DEFAULT_SETTINGS);
  };

  const baseUrlReadOnly = presetId !== "custom" && presetId !== "azure";
  const referrer =
    typeof window !== "undefined" && window.location?.origin
      ? `${window.location.origin}/*`
      : "https://kukuistudio.com/*";

  return (
    <div
      className="ks-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ks-ai-settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ks-dialog ks-dialog--wide" ref={dialogRef}>
        <h2 id="ks-ai-settings-title" className="ks-dialog__title">
          AI editor settings
        </h2>
        <p className="ks-dialog__message">
          Bring your own provider. Your key stays in this browser only — Kukui Studio never sees
          it or proxies your requests.
        </p>

        <div className="ks-ai-form">
          <label className="ks-ai-form__field">
            <span className="ks-ai-form__label">Provider</span>
            <select
              ref={firstFieldRef}
              className="ks-ai-form__input"
              value={presetId}
              onChange={(e) => pickPreset(e.target.value as ProviderPresetId)}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {activePreset?.description ? (
              <span className="ks-ai-form__hint">{activePreset.description}</span>
            ) : null}
          </label>

          <label className="ks-ai-form__field">
            <span className="ks-ai-form__label">Base URL</span>
            <input
              type="url"
              className="ks-ai-form__input"
              value={draft.baseUrl}
              readOnly={baseUrlReadOnly}
              placeholder={
                presetId === "azure"
                  ? "https://<resource>.openai.azure.com/openai/deployments/<deployment>"
                  : "https://api.openai.com/v1"
              }
              onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
              aria-describedby="ks-ai-baseurl-hint"
            />
            {baseUrlReadOnly ? (
              <span className="ks-ai-form__hint" id="ks-ai-baseurl-hint">
                Pick &quot;Custom&quot; to edit.
              </span>
            ) : null}
          </label>

          <label className="ks-ai-form__field">
            <span className="ks-ai-form__label">Model</span>
            <input
              type="text"
              className="ks-ai-form__input"
              value={draft.model}
              placeholder="gpt-4o-mini"
              onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
            />
          </label>

          <label className="ks-ai-form__field">
            <span className="ks-ai-form__label">API key</span>
            <input
              type="password"
              className="ks-ai-form__input"
              autoComplete="off"
              spellCheck={false}
              value={keyDirty ? keyInput : ""}
              placeholder={
                !keyDirty && draft.apiKey ? `Saved (${maskKey(draft.apiKey)})` : "sk-…"
              }
              onChange={(e) => {
                setKeyDirty(true);
                setKeyInput(e.target.value);
              }}
              aria-describedby="ks-ai-key-hint"
            />
            <span className="ks-ai-form__hint" id="ks-ai-key-hint">
              Stored in your browser only. Most providers let you restrict a key to a specific
              referrer in their dashboard — paste{" "}
              <code className="ks-ai-form__code">{referrer}</code> into the restriction field if
              yours supports it.
            </span>
          </label>

          <fieldset className="ks-ai-form__field">
            <legend className="ks-ai-form__label">Storage</legend>
            <div className="ks-ai-form__radio-row">
              <label className="ks-ai-form__radio">
                <input
                  type="radio"
                  name="ks-ai-storage"
                  value="local"
                  checked={draft.storage === "local"}
                  onChange={() => setDraft((d) => ({ ...d, storage: "local" }))}
                />
                <span>Persistent (this browser)</span>
              </label>
              <label className="ks-ai-form__radio">
                <input
                  type="radio"
                  name="ks-ai-storage"
                  value="session"
                  checked={draft.storage === "session"}
                  onChange={() => setDraft((d) => ({ ...d, storage: "session" }))}
                />
                <span>This session only</span>
              </label>
            </div>
          </fieldset>

          {activePreset?.signupUrl ? (
            <p className="ks-ai-form__pointer">
              Need a key?{" "}
              <a
                href={activePreset.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="kukui-studio-footer__link"
              >
                Get one from {activePreset.label} →
              </a>
            </p>
          ) : null}
        </div>

        <div className="ks-dialog__actions ks-dialog__actions--split">
          <button
            type="button"
            className="kukui-studio-btn kukui-studio-btn--ghost"
            onClick={handleClearAll}
          >
            Clear all
          </button>
          <div className="ks-dialog__actions">
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--primary"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
