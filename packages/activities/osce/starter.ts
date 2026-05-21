/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted from apps/studio-app/src/starters.ts (LEGACY_STARTERS).
 */
const starter = {
  version: "1.0",
  title: "OSCE Encounter",
  caseHeader: "Patient presentation: …",
  phases: [
    {
      id: "history",
      name: "History",
      actions: [
        { id: "a1", text: "Ask about chest pain", correct: true },
        { id: "a2", text: "Ask about diet preferences", correct: false },
      ],
    },
    {
      id: "exam",
      name: "Exam",
      actions: [
        { id: "a3", text: "Auscultate the heart", correct: true },
        { id: "a4", text: "Palpate the calves", correct: true },
      ],
    },
  ],
  expectedOrder: ["history", "exam"],
  behaviour: { enableRetry: true },
};

export default starter;
