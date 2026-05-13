import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";
import { SAFE_MEDIA_URL } from "./url.js";

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
        src: SAFE_MEDIA_URL,
        scale: z.number().positive().optional(),
      })
      .strict(),
    camera: z
      .object({
        mode: z.enum(["orbit"]).optional(),
        initialDistance: z.number().positive().optional(),
        minDistance: z.number().positive().optional(),
        maxDistance: z.number().positive().optional(),
        target: Vector3.optional(),
        // Full camera-position snapshot captured by the Studio editor's
        // "Save current view" action. When set, the runtime starts the
        // OrbitControls at exactly this position looking at `target`.
        // Authors who set `initialDistance` only still work — that path
        // is the fallback.
        initialPosition: Vector3.optional(),
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
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict();

export type Hotspot3DConfig = z.infer<typeof Hotspot3DConfigSchema>;
