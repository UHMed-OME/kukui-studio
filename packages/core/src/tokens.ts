/**
 * Design tokens as JavaScript constants.
 *
 * The canonical tokens live in CSS via `@theme` (apps/engine-web/src/styles.css)
 * and are documented in docs/design-system.md. This module mirrors them for
 * contexts that can't use CSS variables — primarily three.js / react-three-fiber
 * material colors, where the renderer needs a hex string at construction time.
 *
 * Keep these values in lockstep with the CSS @theme block. Adding a new token
 * means: design-system.md → CSS @theme → here.
 */
export const tokens = {
  bg: "#fcf8f2",
  surface: "#ffffff",
  textPrimary: "#1c1e20",
  textSecondary: "#606069",
  border: "#dad2c6",
  borderHover: "#bbae9a",
  primary: "#7b4324",
  primaryHover: "#9b5830",
  success: "#2e6e41",
  error: "#c34132",
  tipBg: "#f2f0e8",
  /** 3D canvas backdrop — added 2026-05-06 for r3f scenes. */
  canvas3d: "#0b0b10",
} as const;

export type ColorToken = keyof typeof tokens;
