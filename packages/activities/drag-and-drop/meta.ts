import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Drag and Drop";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Drag labels onto matching drop zones over a background image (or a plain stage).";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Drag-and-drop sits at "apply" (use a learned schema to place items),
 * matching the legacy LEGACY_BLOOM map in apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "apply";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
