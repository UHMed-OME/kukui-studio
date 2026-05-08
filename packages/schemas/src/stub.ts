import { z } from "zod";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Schema for activities that are listed in the catalog but not yet
 * implemented. Lets authors save design notes against the activity
 * without forcing a full schema; the runtime renders a placeholder.
 *
 * Marked passthrough so any spec-in-progress fields don't get stripped.
 */
export const StubConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();

export type StubConfig = z.infer<typeof StubConfigSchema>;
