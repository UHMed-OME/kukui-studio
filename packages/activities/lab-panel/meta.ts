import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Lab Panel Interpretation";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners read a lab panel (CBC, BMP, ABG, etc.), click the result rows they consider abnormal, then pick the correct pattern interpretation from a multiple-choice list.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Reading individual lab values and inferring a pattern (metabolic
 * acidosis, anion-gap, etc.) requires breaking the panel apart and
 * comparing values against references, matching the legacy LEGACY_BLOOM
 * map entry ("analyze") in apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "analyze";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
