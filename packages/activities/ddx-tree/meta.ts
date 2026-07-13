import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Differential Diagnosis Tree";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners walk a clinical decision tree, picking investigations, tests, and ultimately a diagnosis. Each choice adds clinical detail to a running case-so-far panel, and terminal nodes yield the final score.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Picking the next investigation or committing to a diagnosis requires
 * judging competing hypotheses against evolving evidence, matching the
 * legacy LEGACY_BLOOM map entry ("evaluate") in apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "evaluate";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
