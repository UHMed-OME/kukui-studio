import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "OSCE Clinical Encounter";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners work a simulated patient encounter through sequenced phases (history, exam, investigations, management), selecting actions from each phase's checklist. Scored on what they did and the order they did it in.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Sequencing phases and weighing which actions belong in each phase
 * requires judging competing clinical priorities against evolving
 * evidence, matching the legacy LEGACY_BLOOM map entry ("evaluate") in
 * apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "evaluate";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
