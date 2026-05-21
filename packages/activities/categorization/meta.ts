import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Categorization";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners sort items into named category bins by drag-and-drop or keyboard select.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Categorization sits at "apply" (use classification rules to place new
 * exemplars into the right group), matching the legacy LEGACY_BLOOM map
 * in apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "apply";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
