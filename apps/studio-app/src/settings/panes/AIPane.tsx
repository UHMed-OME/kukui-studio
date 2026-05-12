import { useEffect, useMemo, useRef, useState } from "react";
import {
  type AISettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  clearSettings,
  maskKey,
} from "../../ai/settings.js";
import {
  PRESETS,
  findPreset,
  presetForBaseUrl,
  type ProviderPresetId,
} from "../../ai/presets.js";

/**
 * AI Assist pane of the multi-pane Settings dialog. This is the body of
 * the old standalone AISettingsDialog, lifted out so the dialog chrome
 * (backdrop, escape handler, close button) is owned by the parent.
 *
 * Bring-your-own-key: provider preset → base URL + model, password input
 * for the API key (masks last 4 chars on reopen), persistent vs session
 * storage choice. "Clear all" wipes both storages so a stale key can't
 * hide.
 */
export function AIPane({ onSaved }: { onSaved?: (s: AISettings) => void }) {
  const [draft, setDraft] = useState<AISettings>(DEFAULT_SETTINGS);
  const [presetId, setPresetId] = useState<ProviderPresetId>("custom");
  const [keyInput, setKeyInput] = useState("");
  const [keyDirty, setKeyDirty] = useState(false);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const loaded = loadSettings();
    setDraft(loaded);
    setPresetId(loaded.baseUrl ? presetForBaseUrl(loaded.baseUrl) : "custom");
    setKeyInput("");
    setKeyDirty(false);
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }, []);

  const activePreset = useMemo(() => findPreset(presetId), [presetId]);

  const pickPreset = (id: ProviderPresetId) => {
    setPresetId(id);
    const p = findPreset(id);
    if (!p) return;
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
    <div className="ks-settings-pane">
      <p className="ks-dialog__message">
        Bring your own provider. Your key stays in this browser only — Kukui
        Studio never sees it or proxies your requests.
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
            Stored in your browser only. Most providers let you restrict a key
            to a specific referrer in their dashboard — paste{" "}
            <code className="ks-ai-form__code">{referrer}</code> into the
            restriction field if yours supports it.
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

      <div className="ks-settings-pane__actions">
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--ghost"
          onClick={handleClearAll}
        >
          Clear all
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
  );
}
