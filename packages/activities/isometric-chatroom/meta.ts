import type { BloomLevel } from "@kukui/activities/types";

/** Display name. From LEGACY_LABELS in apps/studio-app/src/starters.ts. */
export const label = "Pixel Chat (Live)";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Live isometric pixel-art room. Students join as avatars, walk around, type speech bubbles, and react with emoji while the instructor drives the discussion.";

/**
 * Bloom's taxonomy level. From the commented-out LEGACY_BLOOM entry in
 * App.tsx — synchronous discussion with peer reasoning and emoji-based
 * reaction is primarily evaluative.
 */
export const bloom: BloomLevel = "evaluate";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = true;
