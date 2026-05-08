import { z } from "zod";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const Vector3 = z.object({ x: z.number(), y: z.number(), z: z.number() }).strict();

export const Hotspot3DConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    prompt: z.string().min(1),
    model: z
      .object({
        src: z.string().min(1),
        scale: z.number().positive().optional(),
        rotation: Vector3.optional(),
        position: Vector3.optional(),
      })
      .strict(),
    camera: z
      .object({
        mode: z.enum(["orbit", "fixed"]).optional(),
        initialDistance: z.number().positive().optional(),
        minDistance: z.number().positive().optional(),
        maxDistance: z.number().positive().optional(),
        target: Vector3.optional(),
      })
      .strict()
      .optional(),
    hotspots: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().optional(),
            position: Vector3,
            radius: z.number().positive(),
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
        allowOrbit: z.boolean().optional(),
        singlePoint: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        tryAgainButton: z.string().optional(),
        resetViewButton: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type Hotspot3DConfig = z.infer<typeof Hotspot3DConfigSchema>;
