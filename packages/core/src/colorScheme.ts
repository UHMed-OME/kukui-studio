/**
 * Color-scheme system — light / dark with system follow.
 *
 * Stored preference is one of "system" | "light" | "dark". The resolved
 * scheme written to `html[data-color-scheme]` is always concretely "light"
 * or "dark" — CSS only needs to handle two cases, and the system→resolved
 * mapping happens here. When the stored preference is "system" we also
 * subscribe to `matchMedia("(prefers-color-scheme: dark)")` so the
 * resolved value updates live if the user changes their OS theme.
 *
 * This is intentionally orthogonal to the glass/flat axis in `theme.ts` —
 * `data-theme` and `data-color-scheme` are independent attributes.
 */

/**
 * All schemes that can be applied directly to `<html data-color-scheme>`.
 * Each value has a matching `[data-color-scheme="<value>"]` CSS block in
 * the apps' styles.css. Mirror of THEME_VALUES from @kukui/schemas (sans
 * "auto"), duplicated here to avoid a runtime dep on schemas inside core.
 */
const RESOLVED_SCHEMES = [
  "light",
  "dark",
  "high-contrast",
  "high-contrast-dark",
  "sepia",
  "oled",
  "print",
  "aloha",
  "kalo",
  "lab",
  "twilight",
  "kai",
] as const;

export type ResolvedColorScheme = (typeof RESOLVED_SCHEMES)[number];
export type ColorSchemePreference = "system" | ResolvedColorScheme;

const STORAGE_KEY = "kukui:color-scheme";

function isResolved(v: unknown): v is ResolvedColorScheme {
  return (RESOLVED_SCHEMES as readonly string[]).includes(v as string);
}

function isPreference(v: unknown): v is ColorSchemePreference {
  return v === "system" || isResolved(v);
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveColorScheme(pref: ColorSchemePreference): ResolvedColorScheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

export function getColorSchemePreference(): ColorSchemePreference {
  // Light is the product default; dark is an explicit opt-in. "system" is no
  // longer offered in the UI but stays valid here so any previously-stored
  // preference still resolves (resolveColorScheme handles it).
  if (typeof localStorage === "undefined") return "light";
  const raw = localStorage.getItem(STORAGE_KEY);
  return isPreference(raw) ? raw : "light";
}

export function persistColorSchemePreference(pref: ColorSchemePreference): void {
  if (typeof localStorage === "undefined") return;
  if (pref === "system") {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, pref);
  }
}

export function applyColorScheme(resolved: ResolvedColorScheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-color-scheme", resolved);
}

let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;
let mediaQuery: MediaQueryList | null = null;

function unsubscribeSystem(): void {
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener("change", mediaListener);
  }
  mediaListener = null;
  mediaQuery = null;
}

function subscribeSystem(onChange: (resolved: ResolvedColorScheme) => void): void {
  if (typeof window === "undefined" || !window.matchMedia) return;
  unsubscribeSystem();
  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaListener = (e) => onChange(e.matches ? "dark" : "light");
  mediaQuery.addEventListener("change", mediaListener);
}

/**
 * Set the user's color-scheme preference: persists to localStorage,
 * applies the resolved value to <html>, and manages the system-follow
 * subscription. Listeners fire on resolved-value changes so subscribers
 * can react (e.g. SettingsDialog rerender).
 */
export function setColorSchemePreference(
  pref: ColorSchemePreference,
  onResolvedChange?: (resolved: ResolvedColorScheme) => void,
): ResolvedColorScheme {
  persistColorSchemePreference(pref);
  const resolved = resolveColorScheme(pref);
  applyColorScheme(resolved);
  if (pref === "system") {
    subscribeSystem((r) => {
      applyColorScheme(r);
      onResolvedChange?.(r);
    });
  } else {
    unsubscribeSystem();
  }
  return resolved;
}

/** Boot-time entry: read preference, apply, wire system listener. */
export function initColorScheme(): ResolvedColorScheme {
  const pref = getColorSchemePreference();
  const resolved = resolveColorScheme(pref);
  applyColorScheme(resolved);
  if (pref === "system") {
    subscribeSystem(applyColorScheme);
  }
  return resolved;
}
