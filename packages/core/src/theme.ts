/**
 * Theme system — glass (default) ↔ flat (accessibility-first).
 *
 * Glass: translucent surfaces, soft multi-layer shadows, gentle gradient
 * background. Modern, more depth, slightly less raw contrast.
 *
 * Flat: opaque surfaces, single-layer shadows, solid background. Current
 * design-system look. Tuned for WCAG 2.2 AA contrast at every interactive
 * boundary.
 *
 * The chosen theme is applied via `data-theme` on `<html>` so any
 * stylesheet targeting `html[data-theme="glass"]` or `html[data-theme="flat"]`
 * can override tokens. Choice persists in localStorage.
 *
 * Auto-flip rules (still respected when the user hasn't explicitly chosen):
 *   - `prefers-reduced-transparency: reduce` → flat
 *   - `prefers-contrast: more` → flat
 *   - everyone else → glass
 */

export type Theme = "glass" | "flat";

const STORAGE_KEY = "kukui:theme";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "glass";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "glass" || stored === "flat") return stored;
  } catch {
    /* localStorage unavailable */
  }
  if (typeof window.matchMedia === "function") {
    if (window.matchMedia("(prefers-reduced-transparency: reduce)").matches) return "flat";
    if (window.matchMedia("(prefers-contrast: more)").matches) return "flat";
  }
  return "glass";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* noop */
  }
}

/** Read once (cache-safe), apply, return the active theme. */
export function initTheme(): Theme {
  const t = getInitialTheme();
  applyTheme(t);
  return t;
}
