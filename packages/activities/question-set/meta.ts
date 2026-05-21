import type { BloomLevel } from "@kukui/activities/types";

/** Display name. (Hidden from Studio's catalog via STUDIO_SUPPRESSED in App.tsx.) */
export const label = "Question Set";

/** One-line description for any tooling that asks. */
export const description =
  "Bundle a sequence of multiple-choice and fill-in-the-blanks questions into a single graded set with per-question weights and aggregate scoring.";

/**
 * Bloom's taxonomy level. Question-set is not in LEGACY_BLOOM (it's hidden
 * from Studio's catalog) and is a generic graded-quiz container — "apply"
 * is the reasonable default per Plan 2 per-activity notes for this task.
 */
export const bloom: BloomLevel = "apply";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
