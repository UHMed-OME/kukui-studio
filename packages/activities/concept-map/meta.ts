import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Concept Map";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners build a node-link diagram of relationships between concepts — drag nodes onto a canvas, draw labeled edges between them, and submit for partial credit against an optional answer key.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Constructing a node-link map exercises breaking ideas apart and inferring
 * relationships between them, matching the legacy LEGACY_BLOOM map entry in
 * apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "analyze";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
