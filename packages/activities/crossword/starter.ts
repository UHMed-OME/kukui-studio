/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted from apps/studio-app/src/starters.ts (LEGACY_STARTERS).
 */
const starter = {
  version: "1.0",
  title: "Crossword",
  prompt: "Solve the crossword using the clues below.",
  // Clues are written so the answer can't be confused with another
  // entry in the list — e.g. "Largest artery" used to read like a
  // synonym for ARTERY (also in the list) instead of pointing at
  // AORTA specifically.
  entries: [
    { id: "e1", term: "AORTA", definition: "Major vessel leaving the left ventricle" },
    { id: "e2", term: "ARTERY", definition: "Generic name for any vessel carrying blood away from the heart" },
    { id: "e3", term: "VEIN", definition: "Vessel that returns blood to the heart" },
    { id: "e4", term: "VALVE", definition: "Flap that prevents backflow between heart chambers" },
    { id: "e5", term: "ATRIUM", definition: "Upper heart chamber that receives incoming blood" },
  ],
  behaviour: { allowReveal: true, allowReshuffle: true, showHints: true },
};

export default starter;
