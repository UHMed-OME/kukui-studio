import { z } from "zod";
import { ScoringSchema, AppearanceSchema, SAFE_MEDIA_URL } from "@kukui/schemas/shared";

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
        /**
         * Optional photographer / source credit for the image, rendered
         * as a small footer line under the activity. Only meaningful when
         * an image is set. CC0 / public-domain images need no credit, but
         * a courtesy credit for the photographer is good practice.
         */
        attribution: z
          .object({
            author: z.string().min(1),
            authorUrl: z.string().url().optional(),
            sourceUrl: z.string().url().optional(),
            license: z.string().min(1).optional(),
            licenseUrl: z.string().url().optional(),
          })
          .strict()
          .optional(),
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
        checkAnswerButton: z.string().optional(),
        tryAgainButton: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict()
  .refine((c) => c.hotspots.some((h) => h.correct), {
    message: "At least one hotspot must be marked correct",
    path: ["hotspots"],
  });

export type Hotspot2DConfig = z.infer<typeof Hotspot2DConfigSchema>;
