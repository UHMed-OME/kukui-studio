/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted verbatim from apps/studio-app/src/starters.ts. Even though
 * question-set is in STUDIO_SUPPRESSED (hidden from the catalog because
 * it's embedded inside other activities), keeping a starter here lets the
 * manifest merge in a default value for any tool that does ask for one.
 */
const starter = {
  version: "1.0",
  title: "Question Set",
  questions: [
    {
      type: "multipleChoice",
      config: {
        version: "1.0",
        title: "Question 1",
        question: "What's the answer?",
        answers: [
          { text: "A", correct: true },
          { text: "B", correct: false },
        ],
      },
    },
  ],
  passPercentage: 50,
  behaviour: { enableRetry: true, showProgressBar: true },
};

export default starter;
