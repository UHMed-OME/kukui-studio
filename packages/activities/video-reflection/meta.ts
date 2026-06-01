import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Video Reflection";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners record a short video reflection (webcam, plus optional screen share on supported devices), download it, and submit it to the course dropbox for completion credit.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter. A
 * spoken/recorded reflection produces original work (articulating
 * reasoning, self-assessment), matching the "create" tier used by the
 * sibling audio-recording activity.
 */
export const bloom: BloomLevel = "create";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
