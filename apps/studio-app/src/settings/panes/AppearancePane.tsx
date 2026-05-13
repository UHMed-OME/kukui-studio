import { useEffect, useState } from "react";
import {
  type ColorSchemePreference,
  type ResolvedColorScheme,
  getColorSchemePreference,
  resolveColorScheme,
  setColorSchemePreference,
} from "@kukui/core";

/**
 * Appearance pane of the Settings dialog. Three radio options:
 * System (default — follows OS prefers-color-scheme), Light, Dark.
 * The choice persists to localStorage via setColorSchemePreference,
 * which also updates the `data-color-scheme` attribute on <html> and
 * subscribes to OS-level changes when the user picks System.
 */
const OPTIONS: Array<{
  value: ColorSchemePreference;
  label: string;
  description: string;
}> = [
  {
    value: "system",
    label: "System",
    description: "Match your operating system theme.",
  },
  {
    value: "light",
    label: "Light",
    description: "Always use the light off-white palette.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark stone palette.",
  },
];

export function AppearancePane() {
  const [pref, setPref] = useState<ColorSchemePreference>(() =>
    getColorSchemePreference(),
  );
  const [resolved, setResolved] = useState<ResolvedColorScheme>(() =>
    resolveColorScheme(getColorSchemePreference()),
  );

  useEffect(() => {
    const r = setColorSchemePreference(pref, setResolved);
    setResolved(r);
  }, [pref]);

  return (
    <div className="ks-settings-pane">
      <p className="ks-dialog__message">
        Choose how Kukui Studio looks. Your activities, the gradebook
        preview, and the editor all use the same palette.
      </p>

      <fieldset className="ks-appearance-options" aria-label="Color scheme">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={[
              "ks-appearance-option",
              pref === opt.value ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              type="radio"
              name="ks-appearance-scheme"
              value={opt.value}
              checked={pref === opt.value}
              onChange={() => setPref(opt.value)}
            />
            <span className="ks-appearance-option__body">
              <strong>{opt.label}</strong>
              <span className="ks-appearance-option__desc">
                {opt.description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {pref === "system" ? (
        <p className="ks-appearance-resolved">
          Currently resolved to <strong>{resolved}</strong>.
        </p>
      ) : null}
    </div>
  );
}
