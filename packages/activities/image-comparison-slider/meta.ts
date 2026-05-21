import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Image Comparison Slider";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners drag a vertical seam between a 'before' and 'after' image to compare them side by side; completion-only (Done marks the activity complete).";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Comparing two visually similar images to spot differences exercises
 * analytical inspection, matching the legacy LEGACY_BLOOM map entry in
 * apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "analyze";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
