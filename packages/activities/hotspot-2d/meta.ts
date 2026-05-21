import type { BloomLevel } from "@kukui/activities/types";

/** Display name. Visible in Studio's catalog as a standalone authoring target. */
export const label = "Image Hotspots";

/** One-line description for any tooling that asks. */
export const description =
  "Show a 2D image and ask the learner to identify a labeled region by clicking (or selecting from a keyboard-equivalent fallback list).";

/**
 * Bloom's taxonomy level. From LEGACY_BLOOM in App.tsx — picking the
 * labeled region exercises recognition / classification of a visual
 * concept on the image.
 */
export const bloom: BloomLevel = "understand";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
