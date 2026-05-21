import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Image Annotation";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners draw rectangles, circles, arrows, or freehand marks over an image to highlight features; optional ground-truth regions enable IoU-based scoring.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter.
 * Visually inspecting an image and marking salient features (lesions,
 * anatomical landmarks, errors) exercises analytical comparison, matching
 * the legacy LEGACY_BLOOM map entry in apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "analyze";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
