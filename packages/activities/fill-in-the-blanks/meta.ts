import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Fill in the Blanks";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description = "Cloze-style activity with blanks to fill in.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter. FIB is a
 * quiz-style kind and is currently suppressed from Studio's catalog (see
 * STUDIO_SUPPRESSED in App.tsx), so this value only matters once it surfaces.
 */
export const bloom: BloomLevel = "understand";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
