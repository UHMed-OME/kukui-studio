import { z } from "zod";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const ScoreBand = z.object({
  from: z.number(),
  to: z.number(),
  message: z.string(),
});

/**
 * Lab Panel Interpretation — learner sees a lab panel (CBC, BMP, ABG, etc.),
 * clicks the result rows they consider abnormal, then picks the correct
 * pattern interpretation from a multiple-choice list (e.g. "metabolic
 * acidosis").
 *
 * Scoring combines the abnormal-flagging task with the interpretation MC:
 * one point per correctly classified row + one for the right interpretation.
 * Under `singlePoint` the learner must get every row plus the interpretation
 * exactly right to score.
 */

const LabValue = z
  .object({
    id: z.string().min(1),
    /** Plain-text analyte name (e.g. "pH"). */
    analyte: z.string().min(1),
    /** Result expressed as a string so authors can preserve formatting. */
    result: z.string().min(1),
    /** Optional units string (e.g. "mmol/L"). */
    units: z.string().optional(),
    /** Optional reference range (e.g. "7.35–7.45"). */
    reference: z.string().optional(),
    /** Optional flag hint shown alongside the result. */
    flag: z.enum(["high", "low", "normal"]).optional(),
    /** Whether this row should be marked abnormal for full credit. */
    isAbnormal: z.boolean(),
  })
  .strict();

const Choice = z
  .object({
    id: z.string().min(1),
    /** HTML — author-controlled. Sanitized at render. */
    text: z.string().min(1),
    correct: z.boolean(),
    /** Optional inline per-choice feedback shown after submit. */
    feedback: z.string().optional(),
  })
  .strict();

export const LabPanelConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    /** HTML — case description / scenario shown above the panel. */
    prompt: z.string().min(1),
    panel: z
      .object({
        name: z.string().min(1),
        values: z
          .array(LabValue)
          .min(1)
          .refine(
            (arr) => {
              const ids = new Set<string>();
              for (const v of arr) {
                if (ids.has(v.id)) return false;
                ids.add(v.id);
              }
              return true;
            },
            { message: "Lab value ids must be unique" },
          ),
      })
      .strict(),
    interpretation: z
      .object({
        /** HTML — question stem about the panel pattern. */
        question: z.string().min(1),
        choices: z
          .array(Choice)
          .min(2)
          .refine((arr) => arr.filter((c) => c.correct).length === 1, {
            message: "Exactly one interpretation choice must be correct",
          })
          .refine(
            (arr) => {
              const ids = new Set<string>();
              for (const c of arr) {
                if (ids.has(c.id)) return false;
                ids.add(c.id);
              }
              return true;
            },
            { message: "Interpretation choice ids must be unique" },
          ),
      })
      .strict(),
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

export type LabPanelConfig = z.infer<typeof LabPanelConfigSchema>;
