import type { BloomLevel } from "@kukui/activities/types";

/** Display name. Visible in Studio's catalog as a standalone authoring target. */
export const label = "Quick Quiz (Live)";

/** One-line description for any tooling that asks. */
export const description =
  "Live single-question MC check. Students answer in real time, and the instructor sees the distribution and reveals the correct answer.";

/**
 * Bloom's taxonomy level. From LEGACY_BLOOM in App.tsx — picking the
 * best answer from competing options is an evaluative act when the
 * options force a judgment between similar choices.
 */
export const bloom: BloomLevel = "evaluate";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = true;
