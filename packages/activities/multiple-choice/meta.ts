import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Multiple Choice";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description = "Single-question quiz with selectable answers and per-answer feedback.";

/** Bloom's taxonomy level — drives Studio's cognitive-level filter. */
export const bloom: BloomLevel = "understand";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
