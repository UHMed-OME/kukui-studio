/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted from apps/studio-app/src/starters.ts (LEGACY_STARTERS).
 */
const starter = {
  version: "1.0",
  title: "Highlight Text",
  prompt: "Highlight the verbs in this sentence.",
  tokens: [
    { id: "t1", text: "The", correct: false },
    { id: "t2", text: "cat", correct: false },
    { id: "t3", text: "ran", correct: true },
    { id: "t4", text: "quickly", correct: false },
  ],
  behaviour: { enableRetry: true },
};

export default starter;
