import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { SAFE_MEDIA_URL } from "./url.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const NormRect = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .strict();

export const ImageAnnotationConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().min(1),
    // Image is optional at the schema level — without one the runtime
    // shows an "add an image" empty state instead of an annotatable
    // canvas. When set, both `src` and `alt` are required.
    image: z
      .object({
        src: SAFE_MEDIA_URL,
        alt: z.string().min(1),
      })
      .strict()
      .optional(),
    tools: z
      .object({
        rectangle: z.boolean().optional(),
        circle: z.boolean().optional(),
        arrow: z.boolean().optional(),
        freehand: z.boolean().optional(),
      })
      .strict()
      .optional(),
    expectedAnnotations: z
      .array(
        z
          .object({
            id: z.string().min(1),
            rect: NormRect,
            label: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        singlePoint: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        submitButtonLabel: z.string().optional(),
        clearButton: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
  })
  .strict();

export type ImageAnnotationConfig = z.infer<typeof ImageAnnotationConfigSchema>;
