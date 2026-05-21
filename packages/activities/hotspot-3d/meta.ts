import type { BloomLevel } from "@kukui/activities/types";

/** Display name. Visible in Studio's catalog as a standalone authoring target. */
export const label = "3D Hotspots";

/** One-line description for any tooling that asks. */
export const description =
  "Show a 3D model and ask the learner to identify a labeled part by clicking the right hotspot (or selecting from a keyboard-equivalent fallback list).";

/**
 * Bloom's taxonomy level. From LEGACY_BLOOM in App.tsx — picking the
 * correct anatomical part in 3D exercises use-of-procedure in a new
 * context (applying part-identification to a fresh model).
 */
export const bloom: BloomLevel = "apply";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
