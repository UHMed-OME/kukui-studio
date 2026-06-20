import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Clinical Case";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Work through a clinical anatomy case end to end: interpret the patient presentation and imaging findings, justify a differential diagnosis from the underlying anatomy, and choose how to demonstrate that reasoning. Sections step from presentation through anatomy, diagnosis, a formative quiz, and an assignment-format chooser.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Interpreting imaging against anatomy and constructing/justifying a
 * differential (ruling findings in and out) is analysis.
 */
export const bloom: BloomLevel = "analyze";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
