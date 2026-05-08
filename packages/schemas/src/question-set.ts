import { z } from "zod";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

export const QuestionSetConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    questions: z
      .array(
        z
          .object({
            type: z.enum(["multipleChoice", "fillInTheBlanks"]),
            config: z.record(z.string(), z.unknown()),
            weight: z.number().min(0).optional(),
          })
          .strict(),
      )
      .min(1),
    passPercentage: z.number().min(0).max(100).optional(),
    behaviour: z
      .object({
        randomQuestions: z.boolean().optional(),
        showResults: z.boolean().optional(),
        enableRetry: z.boolean().optional(),
        showProgressBar: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        nextQuestionButton: z.string().optional(),
        previousQuestionButton: z.string().optional(),
        submitSetButton: z.string().optional(),
        tryAgainButton: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type QuestionSetConfig = z.infer<typeof QuestionSetConfigSchema>;
