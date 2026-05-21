import type { BloomLevel } from "@kukui/activities/types";

/** Display name. Visible in Studio's catalog as a standalone authoring target. */
export const label = "Word Cloud (Live)";

/** One-line description for any tooling that asks. */
export const description =
  "Live free-text submissions — students each post one or two short words; everyone watches an emergent frequency tally form in real time.";

/**
 * Bloom's taxonomy level. From LEGACY_BLOOM in App.tsx — short-answer
 * recall against a prompt exercises the "remember" cognitive level.
 */
export const bloom: BloomLevel = "remember";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = true;
