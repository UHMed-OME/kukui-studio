import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";
import { SAFE_MEDIA_URL } from "./url.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const Rect = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .strict();

export const Hotspot2DConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().min(1),
    // Image is optional at the schema level: an author can save a draft
    // before picking an image, and the runtime renders an "add an image"
    // empty state. When set, both `src` and `alt` are required — alt is
    // the image's accessible name + the keyboard fallback list anchor.
    image: z
      .object({
        src: SAFE_MEDIA_URL,
        alt: z.string().min(1),
      })
      .strict()
      .optional(),
    hotspots: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().optional(),
            rect: Rect,
            correct: z.boolean(),
            feedback: z.string().optional(),
          })
          .strict(),
      )
      .min(2),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        showHotspotMarkers: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        tryAgainButton: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.optional(),
  })
  .strict();

export type Hotspot2DConfig = z.infer<typeof Hotspot2DConfigSchema>;
