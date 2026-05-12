export const PROMPT = `Activity kind: Crossword.

Pedagogical guidance:
- A list of terms paired with their definitions (clues). The runtime builds the grid; you don't choose placements or coordinates.
- 6–12 entries is the sweet spot. Fewer feels thin; more crowds the clue list.
- **Term constraints (hard):** each term must be 2–32 letters, A–Z only. No spaces, digits, hyphens, accents, or punctuation. Multi-word answers must be concatenated (e.g. "STSEGMENT", not "ST SEGMENT"). The clue should make the concatenation natural.
- Aim for shared letters across terms so intersections are possible — vocabulary that overlaps in common letters (E, A, T, R, I, O, N, S) produces denser, more satisfying puzzles than terms made only of rare letters.
- Definitions are plain prose (no HTML). One sentence is ideal; two if needed. Avoid restating the term inside the clue.
- Keep all terms within one coherent topic so the puzzle reads as a single concept set, not a vocabulary grab bag.`;
