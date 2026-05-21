import { z } from "zod";
import { AppearanceSchema } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Confidence Meter — students each set a 0..100 slider to their
 * current self-rating; the instructor sees the live histogram + mean.
 * Useful for pre/post confidence checks where the *shape* of the
 * distribution matters more than discrete bins (Straw Poll covers
 * that).
 *
 * Scoring is honor-system — the result is informational, not graded.
 */
export const ConfidenceMeterConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().min(1),
    scale: z
      .object({
        min: z.number().int().default(0),
        max: z.number().int().default(100),
        step: z.number().int().min(1).default(1),
        lowLabel: z.string().max(40).optional(),
        highLabel: z.string().max(40).optional(),
        unit: z.string().max(10).optional(),
      })
      .strict()
      .optional(),
    behaviour: z
      .object({
        showLiveResultsToStudents: z.boolean().optional(),
        allowChangeRating: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        openButton: z.string().optional(),
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
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict();

export type ConfidenceMeterConfig = z.infer<typeof ConfidenceMeterConfigSchema>;
