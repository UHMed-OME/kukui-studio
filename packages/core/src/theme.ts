/**
 * Theme system — glass everywhere.
 *
 * The visual default is glass: translucent surfaces, soft multi-layer
 * shadows, gradient backgrounds. There's no in-app toggle; the OS-level
 * accessibility preferences handle the fallback automatically:
 *
 *   - `prefers-reduced-transparency: reduce` → CSS auto-disables blur +
 *     swaps surfaces to opaque (matches the old "flat" look).
 *   - `prefers-contrast: more` → same auto-flatten path.
 *
 * Both are honored via media-query CSS rules that override the glass
 * surfaces directly. No JS toggle is needed; users who've configured
 * their OS for less translucency get a flat experience without action.
 *
 * `Theme` and the helpers are kept exported so any future surface that
 * wants in-app control can opt in without re-introducing the API.
 */

export type Theme = "glass" | "flat";

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

/** Always returns "glass". Kept for API compatibility. */
export function getInitialTheme(): Theme {
  return "glass";
}

/** No-op — there's no longer an in-app toggle to persist. */
export function persistTheme(_theme: Theme): void {
  /* noop */
}

/** Apply the glass theme on app boot. Call from each app's main.tsx. */
export function initTheme(): Theme {
  applyTheme("glass");
  return "glass";
}
