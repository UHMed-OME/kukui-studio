/**
 * Design tokens as JavaScript constants.
 *
 * The canonical tokens live in CSS via `@theme` (apps/engine-web/src/styles.css)
 * and are documented in docs/design-system.md. This module mirrors them for
 * contexts that can't use CSS variables — primarily three.js / react-three-fiber
 * material colors, where the renderer needs a hex string at construction time.
 *
 * Light- and dark-mode variants are exposed separately. Callers that need the
 * active palette at runtime should read the resolved scheme from
 * `document.documentElement.dataset.colorScheme` (set by initColorScheme) and
 * pick the matching object. For r3f materials, prefer reading at scene-mount
 * time and re-running on color-scheme change.
 *
 * Keep these values in lockstep with the CSS @theme block. Adding a new token
 * means: design-system.md → CSS @theme → here.
 */
export const tokens = {
  bg: "#fafaf9",
  surface: "#fdfbf6",
  textPrimary: "#1c1917",
  textSecondary: "#57534e",
  border: "#e7e5e4",
  borderHover: "#d6d3d1",
  primary: "#7b4324",
  primaryHover: "#9b5830",
  success: "#2e6e41",
  error: "#c34132",
  tipBg: "#f5f5f4",
  /** 3D canvas backdrop — added 2026-05-06 for r3f scenes. */
  canvas3d: "#0b0b10",
} as const;

export const tokensDark = {
  bg: "#1c1917",
  surface: "#292524",
  textPrimary: "#fafaf9",
  textSecondary: "#d6d3d1",
  border: "#44403c",
  borderHover: "#57534e",
  primary: "#d39872",
  primaryHover: "#e6b693",
  success: "#86c79a",
  error: "#ed9183",
  tipBg: "#292524",
  canvas3d: "#000000",
} as const;

export type ColorToken = keyof typeof tokens;

/** Return the active palette based on the html[data-color-scheme] attribute. */
export function activeTokens(): typeof tokens {
  if (typeof document === "undefined") return tokens;
  return document.documentElement.dataset.colorScheme === "dark"
    ? (tokensDark as unknown as typeof tokens)
    : tokens;
}
