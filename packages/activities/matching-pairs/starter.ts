/** Minimal valid config used as Studio's "new activity" template. */
const starter = {
  version: "1.0",
  title: "Matching Pairs",
  prompt: "Match each item on the left to its partner on the right.",
  pairs: [
    { id: "p1", left: { text: "Left A" }, right: { text: "Right A" } },
    { id: "p2", left: { text: "Left B" }, right: { text: "Right B" } },
  ],
  behaviour: { enableRetry: true, randomizeRight: true },
  // appearance has a schema .default(): seed it so the Studio form's
  // AJV-required check passes on a fresh draft.
  appearance: { theme: "auto" },
};

export default starter;
