import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const ScoreBand = z.object({
  from: z.number(),
  to: z.number(),
  message: z.string(),
});

export const MultipleChoiceConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    question: z.string().min(1),
    answers: z
      .array(
        z
          .object({
            text: z.string().min(1),
            correct: z.boolean(),
            tip: z.string().optional(),
            feedback: z.string().optional(),
          })
          .strict(),
      )
      .min(2)
      .refine((arr) => arr.some((a) => a.correct), {
        message: "At least one answer must have correct=true",
      }),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        enableSolutionsButton: z.boolean().optional(),
        singlePoint: z.boolean().optional(),
        randomAnswers: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        checkAnswerButton: z.string().optional(),
        showSolutionButton: z.string().optional(),
        tryAgainButton: z.string().optional(),
      })
      .strict()
      .optional(),
    overallFeedback: z.array(ScoreBand).optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict();

export type MultipleChoiceConfig = z.infer<typeof MultipleChoiceConfigSchema>;
