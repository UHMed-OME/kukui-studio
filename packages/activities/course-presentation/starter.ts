/**
 * Minimal valid config used as Studio's "new activity" template. Two slides,
 * the second carrying a complete embedded multiple-choice activity so authors
 * have a working example to edit.
 */
const starter = {
  version: "1.0",
  title: "Course Presentation",
  slides: [
    {
      id: "slide-1",
      title: "Welcome",
      body: "<p>Introduce the topic on this first slide. Use the Next button to advance.</p>",
    },
    {
      id: "slide-2",
      title: "Check your understanding",
      body: "<p>Add some content, then answer the embedded question below.</p>",
      // Seeded with a complete embedded multiple-choice config so the deck
      // demonstrates the embed and the form loads with a working example.
      activity: {
        kind: "multipleChoice",
        config: {
          version: "1.0",
          title: "Quick check",
          question: "<p>Which option is correct?</p>",
          answers: [
            { text: "The correct option", correct: true },
            { text: "A distractor", correct: false },
          ],
        },
      },
    },
  ],
  // Seeded so Studio's RJSF form loads clean: z.toJSONSchema marks a
  // .default() field as `required`, so AJV flags a missing `appearance` on
  // load even though Zod fills the default. (Same pattern as clinical-case's
  // starter.)
  appearance: { theme: "auto" },
};

export default starter;
