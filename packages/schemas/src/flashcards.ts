import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Flashcards / Recall Drill — learner steps through a stack of cards, flipping
 * each to reveal the back, then self-rates "knew it" / "didn't know it".
 * Cards rated "didn't know it" are re-queued at the end of the deck.
 *
 * Self-rating is honor-system, so flashcards are graded as completion-only:
 * once the learner has worked through the deck the activity reports
 * `success: true` to the LMS regardless of the knew/didn't tally. A "Practice
 * again" affordance lets learners run the deck repeatedly.
 */
export const FlashcardsConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
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
      })
      .strict()
      .optional(),
    ui: z
      .object({
        gotItButton: z.string().optional(),
        reviewAgainButton: z.string().optional(),
        nextButton: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict();

export type FlashcardsConfig = z.infer<typeof FlashcardsConfigSchema>;
