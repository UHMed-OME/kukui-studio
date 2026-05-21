import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Reflection Prompt";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners read a prompt and write a free-form reflection; submission is completion-only with an optional word-count minimum.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Reflection asks learners to judge and critique their own thinking,
 * matching the legacy LEGACY_BLOOM map in apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "evaluate";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
