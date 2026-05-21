import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Branching Scenario";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners walk a decision tree of prompts, choosing among options at each step and reaching scored or completion-only outcomes that reflect their path.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter. Branching
 * scenarios put the learner in a judgement role (weighing options, predicting
 * consequences, deciding), matching the legacy LEGACY_BLOOM map entry
 * ("evaluate") in apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "evaluate";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
