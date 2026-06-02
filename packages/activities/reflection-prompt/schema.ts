import { z } from "zod";
import { ScoringSchema, AppearanceSchema } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Reflection Prompt — completion-only free-form writing activity.
 *
 * The learner reads `prompt` (HTML) and writes a free-form response in a
 * textarea. There is no auto-grading: submission always succeeds. If
 * `minWords` is set, the Submit button is disabled until the learner has
 * written at least that many whitespace-delimited words.
 *
 * SCORM 1.2 caps `cmi.suspend_data` at 4096 (LZ-compressed) chars. The
 * runtime hard-caps the textarea at `maxChars` so a long reflection can
 * never be silently truncated by the LMS on save. When unset, a
 * conservative default is applied that keeps any response persistable.
 */
export const ReflectionPromptConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().min(1),
    minWords: z.number().int().nonnegative().optional(),
    /**
     * Maximum characters the learner may type. Hard-capped via the textarea's
     * `maxLength`. Defaults to a value that comfortably round-trips through
     * SCORM `suspend_data`; raising it risks LMS-side truncation of long
     * responses.
     */
    maxChars: z.number().int().positive().optional(),
    placeholder: z.string().optional(),
    ui: z
      .object({
        submitButtonLabel: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict();

export type ReflectionPromptConfig = z.infer<typeof ReflectionPromptConfigSchema>;
