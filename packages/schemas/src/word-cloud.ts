import { z } from "zod";
import { AppearanceSchema } from "./appearance.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Word Cloud — students each submit 1..N short responses (one to a
 * few words); everyone watches an emergent frequency tally. Designed
 * for low-friction sentiment + recall checks ("What stuck with you
 * today?" / "One word that describes the patient's status").
 *
 * Normalisation: by default labels are case-folded + trimmed before
 * being tallied so "Apple" / "apple " count together. Authors can
 * opt out via `behaviour.caseSensitive: true` when case matters
 * (e.g. gene names).
 */
export const WordCloudConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().min(1),
    submissionsPerStudent: z.number().int().min(1).max(10).optional(),
    maxWordsPerSubmission: z.number().int().min(1).max(5).optional(),
    maxCharsPerSubmission: z.number().int().min(2).max(80).optional(),
    behaviour: z
      .object({
        showLiveResultsToStudents: z.boolean().optional(),
        caseSensitive: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        openButton: z.string().optional(),
        revealButton: z.string().optional(),
        resetButton: z.string().optional(),
        submitButton: z.string().optional(),
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
    appearance: AppearanceSchema.optional(),
  })
  .strict();

export type WordCloudConfig = z.infer<typeof WordCloudConfigSchema>;
