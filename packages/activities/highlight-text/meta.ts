import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Highlight Text Spans";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners read a passage and click word or phrase tokens to mark the ones that match the prompt; scoring rewards exact / partial selection.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Highlighting target tokens exercises identification within a passage,
 * matching the legacy LEGACY_BLOOM map entry in apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "understand";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
