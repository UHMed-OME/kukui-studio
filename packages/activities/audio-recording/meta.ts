import type { BloomLevel } from "@kukui/activities/types";

/** Display name shown in Studio's catalog and sidebar. */
export const label = "Audio Recording";

/** One-line description for Studio's catalog and learning-objective matching. */
export const description =
  "Learners record a spoken response to a prompt using the browser's MediaRecorder API, then submit the clip for completion credit.";

/**
 * Bloom's taxonomy level — drives Studio's cognitive-level filter. Audio
 * recording produces original spoken work (reading aloud, pronunciation,
 * explanation), matching the legacy LEGACY_BLOOM map entry ("create") in
 * apps/studio-app/src/App.tsx.
 */
export const bloom: BloomLevel = "create";

/** True if this activity has a Live (Phase 3) classroom variant. */
export const live = false;
