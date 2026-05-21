import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Anatomy Labeling";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners drag named labels onto numbered point-targets on an anatomical illustration; keyboard fallback select per label.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Anatomy labeling exercises identification of named structures on an
 * illustration, matching the legacy LEGACY_BLOOM map entry in
 * apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "understand";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
