import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Sequence Steps";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners reorder a shuffled list of steps into the correct sequence.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Sequence-steps sits at "apply" (use a learned procedure to put steps
 * in correct order), matching the legacy LEGACY_BLOOM map in
 * apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "apply";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
