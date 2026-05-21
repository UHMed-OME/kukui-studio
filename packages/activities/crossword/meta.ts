import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Crossword";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners solve a crossword puzzle generated at runtime from a list of term/definition pairs, with optional reveal, reshuffle, and hint affordances.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter. Crosswords
 * test terminology recall (which clue defines which word), matching the
 * legacy LEGACY_BLOOM map entry ("remember") in apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "remember";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
