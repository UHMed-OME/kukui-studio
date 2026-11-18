/**
 * Minimal valid config used as Studio's "new activity" template.
 * Extracted from apps/studio-app/src/starters.ts.
 */
const starter = {
  version: "1.0",
  title: "Evidence Weighing",
  ratings: [
    { id: "weak", label: "Weak" },
    { id: "moderate", label: "Moderate" },
    { id: "strong", label: "Strong" },
  ],
  claims: [
    {
      claim: "Replace this with your claim, hypothesis, or diagnosis.",
      evidence: [
        { text: "Evidence A", expectedRating: "weak" },
        { text: "Evidence B", expectedRating: "moderate" },
        { text: "Evidence C", expectedRating: "strong" },
      ],
    },
  ],
  behaviour: { enableRetry: true, enableSolutionsButton: true },
  appearance: { theme: "auto" },
};

export default starter;
