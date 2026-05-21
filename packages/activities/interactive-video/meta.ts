import type { BloomLevel } from "@kukui/activities/types";

/** Display name. Visible in Studio's catalog as a standalone authoring target. */
export const label = "Interactive Video";

/** One-line description for any tooling that asks. */
export const description =
  "Play a video that pauses at author-specified timestamps to render embedded multiple-choice or fill-in-the-blanks checkpoints, with aggregate scoring across all required interactions.";

/**
 * Bloom's taxonomy level. From LEGACY_BLOOM in App.tsx — interactive video
 * has learners apply procedures/concepts from the clip to the checkpoint
 * questions.
 */
export const bloom: BloomLevel = "apply";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
