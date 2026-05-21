import { z } from "zod";
import { ScoringSchema, AppearanceSchema } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

// Single A–Z run, length 2..32. The crossword grid is letter-cells only —
// digits, hyphens, spaces, accents (etc.) have no canonical mapping to a
// single cell and would skew the placement algorithm. Authors writing
// "fill-in-the-blanks" style multi-word terms should use a hyphen-stripped
// or unspaced form (e.g. "STSEGMENT") and disambiguate in the definition.
const TERM_RE = /^[A-Za-z]{2,32}$/;

/**
 * Crossword — learner solves a grid built at runtime from a list of
 * `{ term, definition }` pairs. The author provides the words and their
 * clues; the engine picks a layout (intersecting placements, deterministic
 * per seed) so the same JSON yields a stable puzzle within a session but a
 * fresh arrangement when the learner asks for a new round.
 *
 * Scoring is per-cell: `raw` is the count of correctly filled cells,
 * `max` is the total cell count. `success` flips true on full clear.
 *
 * Only A–Z letters are allowed in a term — see TERM_RE above. Definitions
 * are plain prose (no HTML) so they render identically in the clue list
 * and any screen-reader announcement.
 */
export const CrosswordConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().optional(),
    entries: z
      .array(
        z
          .object({
            id: z.string().min(1),
            term: z
              .string()
              .regex(TERM_RE, "Term must be 2–32 A–Z letters (no spaces or punctuation)"),
            definition: z.string().min(1),
            hint: z.string().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(40)
      .refine((arr) => new Set(arr.map((e) => e.id)).size === arr.length, {
        message: "entry ids must be unique",
      })
      .refine(
        (arr) => new Set(arr.map((e) => e.term.toUpperCase())).size === arr.length,
        { message: "terms must be unique (case-insensitive)" },
      ),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        /**
         * If true, the learner can shuffle to a fresh layout without losing
         * already-correct letters. Default true.
         */
        allowReshuffle: z.boolean().optional(),
        /**
         * If true, the "Reveal letter" / "Reveal word" buttons render.
         * Revealing penalises score by marking the revealed cells incorrect
         * for grading purposes. Default true.
         */
        allowReveal: z.boolean().optional(),
        /**
         * If true and any entry has a `hint`, a "Hint" affordance appears
         * for the currently-selected clue. Default true.
         */
        showHints: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        checkButton: z.string().optional(),
        revealLetterButton: z.string().optional(),
        revealWordButton: z.string().optional(),
        reshuffleButton: z.string().optional(),
        submitButton: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict();

export type CrosswordConfig = z.infer<typeof CrosswordConfigSchema>;
