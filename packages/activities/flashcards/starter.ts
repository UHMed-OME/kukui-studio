/** Minimal valid config used as Studio's "new activity" template. */
const starter = {
  version: "1.0",
  title: "Flashcards",
  prompt: "Flip each card; rate yourself honestly.",
  cards: [
    { id: "c1", front: "Front 1", back: "Back 1" },
    { id: "c2", front: "Front 2", back: "Back 2" },
  ],
  behaviour: { shuffle: true },
  // appearance has a schema .default(): seed it so the Studio form's
  // AJV-required check passes on a fresh draft.
  appearance: { theme: "auto" },
};

export default starter;
