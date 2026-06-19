/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted verbatim from apps/studio-app/src/starters.ts.
 */
const starter = {
  version: "1.0",
  title: "Interactive Video",
  prompt: "<p>Watch the clip. It pauses for a question at 0:30 — answer to continue.</p>",
  video: {
    // Big Buck Bunny (Blender Foundation, CC-BY) — a stable, public YouTube
    // clip so the example works out of the box. Swap in your own URL.
    src: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    type: "youtube",
  },
  interactions: [
    {
      id: "iv-1",
      atSeconds: 30,
      required: true,
      kind: "multipleChoice",
      config: {
        version: "1.0",
        title: "Checkpoint",
        question: "<p>Who is the main character of this short film?</p>",
        answers: [
          { text: "A large rabbit", correct: true },
          { text: "A red fox", correct: false },
          { text: "A flying squirrel", correct: false },
        ],
      },
    },
  ],
  behaviour: { enableRetry: true },
};

export default starter;
