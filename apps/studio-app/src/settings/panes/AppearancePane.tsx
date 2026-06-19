import { useEffect, useState } from "react";
import {
  type ColorSchemePreference,
  type ResolvedColorScheme,
  getColorSchemePreference,
  resolveColorScheme,
  setColorSchemePreference,
} from "@kukui/core";

/**
 * Appearance pane of the Settings dialog.
 *
 * The choice persists to localStorage via setColorSchemePreference,
 * which also updates the `data-color-scheme` attribute on <html> and
 * subscribes to OS-level prefers-color-scheme changes when the user
 * picks "System".
 *
 * Schemes are grouped for legibility: Display (the OS-pairable trio),
 * Accessibility (high-contrast pair), and Themes (the aesthetic
 * variants). "Print" is intentionally omitted from user settings —
 * it's an author-only choice and doesn't make sense as a personal
 * default.
 */
type Option = { value: ColorSchemePreference; label: string; description: string };
type Group = { label: string; options: Option[] };

const GROUPS: Group[] = [
  {
    label: "Display",
    options: [
      { value: "light", label: "Light", description: "Neutral light with green accents (default)." },
      { value: "dark", label: "Dark", description: "Neutral dark with green accents." },
    ],
  },
  {
    label: "Accessibility",
    options: [
      {
        value: "high-contrast",
        label: "High contrast (light)",
        description: "WCAG AAA — black on white, deep accents.",
      },
      {
        value: "high-contrast-dark",
        label: "High contrast (dark)",
        description: "WCAG AAA — white on black, light accents.",
      },
    ],
  },
  {
    label: "Themes",
    options: [
      { value: "sepia", label: "Sepia", description: "Warm cream paper, easy on the eyes." },
      { value: "oled", label: "OLED black", description: "Pure-black variant of dark; battery-friendly on AMOLED." },
      { value: "aloha", label: "Aloha", description: "Sunset coral light scheme, energetic." },
      { value: "kalo", label: "Kalo", description: "Taro-leaf dark with sage greens, grounded." },
      { value: "lab", label: "Lab", description: "Cool clinical light scheme with navy accents." },
      { value: "twilight", label: "Twilight", description: "Plum-tinted dark, reflective." },
      { value: "kai", label: "Kai", description: "Clinical ocean-blue light scheme — bright, medical." },
    ],
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
        Choose how Kukui Studio looks. Authors can also pin a specific
        theme per activity — that pin wins for learners viewing the
        SCORM-packaged version.
      </p>

      {GROUPS.map((group) => (
        <fieldset
          key={group.label}
          className="ks-appearance-options"
          aria-label={`Color scheme — ${group.label}`}
        >
          <legend className="ks-appearance-group-legend">{group.label}</legend>
          {group.options.map((opt) => (
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
      ))}

      {pref === "system" ? (
        <p className="ks-appearance-resolved">
          Currently resolved to <strong>{resolved}</strong>.
        </p>
      ) : null}
    </div>
  );
}
