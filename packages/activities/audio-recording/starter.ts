/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted from apps/studio-app/src/starters.ts (LEGACY_STARTERS).
 */
const starter = {
  version: "1.0",
  title: "Audio Recording",
  prompt: "Record yourself reading the passage.",
  maxDurationSeconds: 60,
  minDurationSeconds: 3,
  behaviour: { allowReRecord: true },
};

export default starter;
