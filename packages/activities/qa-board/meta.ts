import type { BloomLevel } from "@kukui/activities/types";

/** Display name. Visible in Studio's catalog as a standalone authoring target. */
export const label = "Q&A Board (Live)";

/** One-line description for any tooling that asks. */
export const description =
  "Live backchannel — students post questions during class, anyone can upvote, the instructor sees the queue ranked by votes and can mark items answered.";

/**
 * Bloom's taxonomy level. From LEGACY_BLOOM in App.tsx — judging
 * which classmate's question best surfaces a gap is an evaluative act.
 */
export const bloom: BloomLevel = "evaluate";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = true;
