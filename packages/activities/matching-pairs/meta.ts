import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Matching Pairs";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners pair each item on the left with its correct partner on the right.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Matching-pairs sits at "remember" (recall term/definition associations),
 * matching the legacy LEGACY_BLOOM map in apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "remember";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
