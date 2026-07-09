/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted from apps/studio-app/src/starters.ts (LEGACY_STARTERS).
 */
const starter = {
  version: "1.0",
  title: "Differential Diagnosis",
  caseHeader: "Patient presents with…",
  startNodeId: "n1",
  nodes: [
    {
      id: "n1",
      presentation: "Choose your next step.",
      choices: [
        { id: "c1", text: "Test A", nextNodeId: "n2" },
        { id: "c2", text: "Test B", nextNodeId: "n3" },
      ],
    },
    {
      id: "n2",
      presentation: "Result A.",
      choices: null,
      diagnosis: { name: "Diagnosis A", correct: true, score: 1 },
    },
    {
      id: "n3",
      presentation: "Result B.",
      choices: null,
      diagnosis: { name: "Diagnosis B", correct: false, score: 0 },
    },
  ],
  behaviour: { enableRetry: true },
  // AppearanceSchema has a .default(), which makes the field required in the
  // derived JSON Schema — seed it so Studio's form validates on first load.
  appearance: { theme: "auto" },
};

export default starter;
