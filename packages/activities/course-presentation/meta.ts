import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Course Presentation";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Move through a sequenced slide deck at your own pace, study the content on each slide, and answer the embedded check-for-understanding activities — building toward the deck's overall concept. Each slide pairs prose and an optional image with an optional embedded multiple-choice or fill-in-the-blanks activity.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter. Working
 * through sequenced content and answering comprehension checks is
 * understanding.
 */
export const bloom: BloomLevel = "understand";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
