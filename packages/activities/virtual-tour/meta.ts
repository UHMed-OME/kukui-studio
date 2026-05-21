import type { BloomLevel } from "@kukui/activities/types";

/** Display name. Visible in Studio's catalog as a standalone authoring target. */
export const label = "Virtual Tour";

/** One-line description for any tooling that asks. */
export const description =
  "Explore a 3D scene first-person and visit clickable points of interest, each opening a panel with text, images, or audio.";

/**
 * Bloom's taxonomy level. From LEGACY_BLOOM in App.tsx — first-person
 * navigation to specific points of interest exercises use-of-procedure
 * (move-look-visit) in a new spatial context.
 */
export const bloom: BloomLevel = "apply";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
