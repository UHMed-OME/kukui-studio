import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Flashcards";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners step through a stack of cards, flipping each to reveal the back and self-rating recall; completion-only scoring.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Flashcards exercise recall of facts and terminology, matching the
 * legacy LEGACY_BLOOM map in apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "remember";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
