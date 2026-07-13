import type { BloomLevel } from "@kukui/activities/types";

/** Display name. Visible in Studio's catalog as a standalone authoring target. */
export const label = "Confidence Meter (Live)";

/** One-line description for any tooling that asks. */
export const description =
  "Live self-assessment slider. Students each set a 0 to 100 rating while the instructor watches the histogram and mean stream in.";

/**
 * Bloom's taxonomy level. From LEGACY_BLOOM in App.tsx — students
 * judge their own grasp of the material against the scale, exercising
 * the "evaluate" cognitive level (self-assessment is a form of
 * critique).
 */
export const bloom: BloomLevel = "evaluate";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = true;
