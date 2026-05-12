import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { SAFE_MEDIA_URL } from "./url.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const Video = z
  .object({
    src: SAFE_MEDIA_URL,
    type: z.enum(["html5", "youtube", "vimeo"]).optional(),
    poster: SAFE_MEDIA_URL.optional(),
  })
  .strict();

const Interaction = z
  .object({
    id: z.string().min(1),
    atSeconds: z.number().min(0),
    required: z.boolean().optional(),
    kind: z.enum(["multipleChoice", "fillInTheBlanks"]),
    config: z.record(z.string(), z.unknown()),
  })
  .strict();

export const InteractiveVideoConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().optional(),
    video: Video,
    interactions: z.array(Interaction),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        passPercentage: z.number().min(0).max(100).optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        resumeButtonLabel: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
  })
  .strict();

export type InteractiveVideoConfig = z.infer<typeof InteractiveVideoConfigSchema>;
