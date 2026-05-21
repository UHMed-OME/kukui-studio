/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted from apps/studio-app/src/starters.ts (LEGACY_STARTERS).
 */
const starter = {
  version: "1.0",
  title: "Concept Map",
  prompt: "Build a concept map.",
  seedNodes: [
    { id: "n1", label: "Concept A", position: { x: 0.3, y: 0.4 } },
    { id: "n2", label: "Concept B", position: { x: 0.7, y: 0.4 } },
  ],
  behaviour: { enableRetry: true, allowFreeText: true },
};

export default starter;
