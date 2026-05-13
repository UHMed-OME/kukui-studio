import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

export const MatchingPairsConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    /** HTML — author-controlled prompt above the columns. Sanitized at render. */
    prompt: z.string().min(1),
    pairs: z
      .array(
        z
          .object({
            id: z.string().min(1),
            left: z
              .object({
                text: z.string().min(1),
              })
              .strict(),
            right: z
              .object({
                text: z.string().min(1),
              })
              .strict(),
          })
          .strict(),
      )
      .min(2),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        singlePoint: z.boolean().optional(),
        /** When true (default), the right column is shuffled at render. */
        randomizeRight: z.boolean().optional(),
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
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict();

export type MatchingPairsConfig = z.infer<typeof MatchingPairsConfigSchema>;
