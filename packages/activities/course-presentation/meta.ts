import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Course Presentation";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Import a slide deck from a PDF, PowerPoint export, or Google Slides link, then make it interactive: drop click-to-reveal info hotspots and embedded multiple-choice or fill-in-the-blanks checkpoints onto the slides. Learners move through at their own pace, explore the hotspots, and answer the checkpoints that build toward the deck's overall concept.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter. Working
 * through sequenced content and answering comprehension checks is
 * understanding.
 */
export const bloom: BloomLevel = "understand";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
