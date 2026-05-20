/**
 * Minimal valid config used as Studio's "new activity" template.
 * Extracted from apps/studio-app/src/starters.ts.
 */
const starter = {
  version: "1.0",
  title: "Multiple Choice",
  question: "Replace this with your question.",
  answers: [
    { text: "Option A", correct: true },
    { text: "Option B", correct: false },
  ],
  behaviour: { enableRetry: true, enableSolutionsButton: false, singlePoint: false },
};

export default starter;
