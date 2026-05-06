import { z } from "zod";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const ScoreBand = z.object({
  from: z.number(),
  to: z.number(),
  message: z.string(),
});

/**
 * Highlight Text Spans — learner reads a passage and clicks word/phrase
 * tokens to mark them. Tokens render in order, separated by single spaces;
 * any non-clickable connecting text/punctuation belongs in `separator` of
 * the preceding token (or simply isn't authored as a token).
 *
 * Scoring uses `scoreSelection` against the set of `correct` tokens. With
 * `singlePoint`, the learner needs the exact set; otherwise partial credit
 * is awarded with -1 per wrong selection (clamped to 0).
 */
export const HighlightTextConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    prompt: z.string().min(1),
    tokens: z
      .array(
        z
          .object({
            id: z.string().min(1),
            text: z.string().min(1),
            correct: z.boolean(),
            /**
             * Optional plain-text content rendered immediately AFTER this
             * token (and before the next token). Use for connective
             * punctuation the author doesn't want clickable, e.g. ",", ".".
             * If omitted, a single space is inserted between tokens.
             */
            separator: z.string().optional(),
          })
          .strict(),
      )
      .min(1)
      .refine(
        (arr) => {
          const ids = new Set<string>();
          for (const t of arr) {
            if (ids.has(t.id)) return false;
            ids.add(t.id);
          }
          return true;
        },
        { message: "Token ids must be unique" },
      )
      .refine((arr) => arr.some((t) => t.correct), {
        message: "At least one token must have correct=true",
      }),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        singlePoint: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        checkAnswerButton: z.string().optional(),
        tryAgainButton: z.string().optional(),
      })
      .strict()
      .optional(),
    overallFeedback: z.array(ScoreBand).optional(),
  })
  .strict();

export type HighlightTextConfig = z.infer<typeof HighlightTextConfigSchema>;
