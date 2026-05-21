/** Minimal valid config used as Studio's "new activity" template. */
const starter = {
  version: "1.0",
  title: "Sequence Steps",
  prompt: "Order these into the correct sequence.",
  steps: [
    { id: "s1", text: "First step" },
    { id: "s2", text: "Second step" },
    { id: "s3", text: "Third step" },
  ],
  behaviour: { enableRetry: true, randomize: true },
};

export default starter;
