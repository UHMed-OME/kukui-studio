import { z } from "zod";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Flashcards / Recall Drill — learner steps through a stack of cards, flipping
 * each to reveal the back, then self-rates "knew it" / "didn't know it".
 * Cards rated "didn't know it" are re-queued at the end of the deck.
 *
 * `passThreshold` is the percentage of total cards that must be marked "knew
 * it" for the activity to report `success: true` to the LMS. Defaults to 80.
 */
export const FlashcardsConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    prompt: z.string().optional(),
    cards: z
      .array(
        z
          .object({
            id: z.string().min(1),
            front: z.string().min(1),
            back: z.string().min(1),
            hint: z.string().optional(),
          })
          .strict(),
      )
      .min(1)
      .refine((arr) => new Set(arr.map((c) => c.id)).size === arr.length, {
        message: "card ids must be unique",
      }),
    behaviour: z
      .object({
        shuffle: z.boolean().optional(),
        passThreshold: z.number().min(0).max(100).optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        knewItButton: z.string().optional(),
        didntKnowButton: z.string().optional(),
        nextButton: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type FlashcardsConfig = z.infer<typeof FlashcardsConfigSchema>;
