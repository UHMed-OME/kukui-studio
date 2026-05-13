import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Reflection Prompt — completion-only free-form writing activity.
 *
 * The learner reads `prompt` (HTML) and writes a free-form response in a
 * textarea. There is no auto-grading: submission always succeeds. If
 * `minWords` is set, the Submit button is disabled until the learner has
 * written at least that many whitespace-delimited words.
 */
export const ReflectionPromptConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().min(1),
    minWords: z.number().int().nonnegative().optional(),
    placeholder: z.string().optional(),
    ui: z
      .object({
        submitButtonLabel: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.optional(),
  })
  .strict();

export type ReflectionPromptConfig = z.infer<typeof ReflectionPromptConfigSchema>;
