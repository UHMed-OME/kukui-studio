/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted from apps/studio-app/src/starters.ts (LEGACY_STARTERS).
 */
const starter = {
  version: "1.0",
  title: "Branching Scenario",
  startNodeId: "n1",
  nodes: [
    {
      id: "n1",
      prompt: "What's your first move?",
      choices: [
        { id: "c1", text: "Option A", nextNodeId: "n2" },
        { id: "c2", text: "Option B", nextNodeId: "n3" },
      ],
    },
    {
      id: "n2",
      prompt: "Outcome A.",
      choices: null,
      outcome: { score: 1, success: true, message: "Good call." },
    },
    {
      id: "n3",
      prompt: "Outcome B.",
      choices: null,
      outcome: { score: 0, success: false, message: "Try again." },
    },
  ],
  behaviour: { enableRetry: true },
};

export default starter;
