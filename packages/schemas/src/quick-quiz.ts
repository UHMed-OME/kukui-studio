import { z } from "zod";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Quick Quiz — Straw Poll's competitive cousin. One MC question with
 * a marked-correct answer; students answer in real time; reveal
 * phase shows the distribution and (optionally) names who got it
 * right. Designed as a formative knowledge check, not a graded
 * exam — there's no anti-cheat / proctoring.
 *
 * For multi-question rounds, run several Quick Quiz activities back-
 * to-back. A dedicated multi-question "Live Quiz" is a future
 * activity, deliberately deferred until the single-question flow has
 * shipped + been used.
 */
export const QuickQuizConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().min(1),
    choices: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            label: z.string().min(1).max(160),
            correct: z.boolean().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(6)
      .refine((arr) => new Set(arr.map((c) => c.id)).size === arr.length, {
        message: "choice ids must be unique",
      })
      .refine((arr) => arr.some((c) => c.correct === true), {
        message: "at least one choice must be marked correct",
      }),
    behaviour: z
      .object({
        showLiveResultsToStudents: z.boolean().optional(),
        revealCorrectAnswer: z.boolean().optional(),
        allowChangeAnswer: z.boolean().optional(),
        showNamesAtReveal: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        openButton: z.string().optional(),
        closeButton: z.string().optional(),
        revealButton: z.string().optional(),
        resetButton: z.string().optional(),
      })
      .strict()
      .optional(),
    live: z
      .object({
        joinKey: z.string().min(4).max(64).optional(),
        adminKey: z.string().min(4).max(64).optional(),
        signaling: z.enum(["nostr", "mqtt"]).optional(),
        relayUrls: z.array(z.string().url()).max(8).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type QuickQuizConfig = z.infer<typeof QuickQuizConfigSchema>;
