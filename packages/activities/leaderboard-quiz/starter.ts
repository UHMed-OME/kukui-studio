/** Minimal valid config used as Studio's "new activity" template. */
const starter = {
  version: "1.0",
  title: "Leaderboard Quiz",
  topics: [{ id: "general", label: "General" }],
  questions: [
    {
      id: "q1",
      topicId: "general",
      prompt: "Medical term for high blood pressure?",
      blanks: [{ acceptedAnswers: ["hypertension"] }],
    },
  ],
  round: { questionCount: 5, shuffle: true, timeLimitSeconds: 60 },
  pointsPerCorrect: 10,
  appearance: { theme: "auto" },
  live: { signaling: "nostr" },
};

export default starter;
