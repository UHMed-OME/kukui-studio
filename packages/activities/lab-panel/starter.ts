/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted from apps/studio-app/src/starters.ts (LEGACY_STARTERS).
 */
const starter = {
  version: "1.0",
  title: "Lab Panel",
  prompt: "Identify abnormal values and pick the best interpretation.",
  panel: {
    name: "Sample panel",
    values: [
      { id: "v1", analyte: "Analyte A", result: "10", flag: "normal", isAbnormal: false },
      { id: "v2", analyte: "Analyte B", result: "100", flag: "high", isAbnormal: true },
    ],
  },
  interpretation: {
    question: "What's the best interpretation?",
    choices: [
      { id: "c1", text: "Option A", correct: true },
      { id: "c2", text: "Option B", correct: false },
    ],
  },
  behaviour: { enableRetry: true },
};

export default starter;
