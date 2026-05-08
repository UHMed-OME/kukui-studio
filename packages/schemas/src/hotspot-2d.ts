import { z } from "zod";

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
    image: z
      .object({
        src: z.string().min(1),
        // Required for AT — the keyboard/region-list fallback also surfaces
        // it as the image's accessible name.
        alt: z.string().min(1),
      })
      .strict(),
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
        singlePoint: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        tryAgainButton: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type Hotspot2DConfig = z.infer<typeof Hotspot2DConfigSchema>;
