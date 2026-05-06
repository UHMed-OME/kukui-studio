import { z } from "zod";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Sequence / Order Steps — learner reorders a shuffled list of items into
 * the correct sequence. The order of `steps` in the config is the *correct*
 * order; the component shuffles for display.
 */
export const SequenceStepsConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    prompt: z.string().min(1),
    steps: z
      .array(
        z
          .object({
            id: z.string().min(1),
            text: z.string().min(1),
          })
          .strict(),
      )
      .min(2)
      .refine((arr) => new Set(arr.map((s) => s.id)).size === arr.length, {
        message: "step ids must be unique",
      }),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        singlePoint: z.boolean().optional(),
        randomize: z.boolean().optional(),
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
  })
  .strict();

export type SequenceStepsConfig = z.infer<typeof SequenceStepsConfigSchema>;
