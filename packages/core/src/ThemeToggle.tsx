import { useEffect, useState } from "react";
import { applyTheme, getInitialTheme, persistTheme, type Theme } from "./theme.js";

/**
 * Visible theme switcher. Shows the active theme; clicking flips to the
 * other and persists the choice. Renders as a compact pill suitable for
 * placement in any app header.
 *
 * Accessibility notes:
 *   - The button has a clear text label ("Glass" or "Flat") plus an icon-
 *     equivalent character, so it's never icon-only.
 *   - aria-pressed reports the alternate state.
 *   - aria-describedby hints what flipping does.
 */
export function ThemeToggle({ className }: { className?: string } = {}) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const next: Theme = theme === "glass" ? "flat" : "glass";
  const label = theme === "glass" ? "Glass" : "Flat";
  const tooltip =
    theme === "glass"
      ? "Switch to a flat, higher-contrast theme."
      : "Switch to the glass / translucent theme.";

  const flip = () => {
    setTheme(next);
    persistTheme(next);
  };

  return (
    <button
      type="button"
      className={["kukui-theme-toggle", className].filter(Boolean).join(" ")}
      onClick={flip}
      aria-label={`Theme: ${label}. Click to switch to ${next}.`}
      title={tooltip}
    >
      <span aria-hidden="true" className="kukui-theme-toggle__glyph">
        {theme === "glass" ? "◐" : "▣"}
      </span>
      <span className="kukui-theme-toggle__label">{label}</span>
    </button>
  );
}
