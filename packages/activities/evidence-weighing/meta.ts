import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Evidence Weighing";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description = "Evaluate how strongly individual pieces of evidence support a claim, hypothesis, or diagnosis.";

/** Bloom's taxonomy level — drives Studio's cognitive-level filter. */
export const bloom: BloomLevel = "evaluate";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
