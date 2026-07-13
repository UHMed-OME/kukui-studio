import type { BloomLevel } from "@kukui/activities/types";

/** Display name. Visible in Studio's catalog as a standalone authoring target. */
export const label = "Straw Poll (Live)";

/** One-line description for any tooling that asks. */
export const description =
  "Live classroom temperature check. The instructor poses a question, students vote, and everyone watches the tally update in real time.";

/**
 * Bloom's taxonomy level. From LEGACY_BLOOM in App.tsx — students judge
 * their own position against a set of choices, exercising the "evaluate"
 * cognitive level (form an opinion, decide where you stand).
 */
export const bloom: BloomLevel = "evaluate";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = true;
