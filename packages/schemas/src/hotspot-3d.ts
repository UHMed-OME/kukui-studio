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
        // Direct GLB/GLTF URL. Required unless `sketchfabUid` is set.
        src: SAFE_MEDIA_URL.optional(),
        // Sketchfab model UID (the 32-char hex from a Sketchfab URL).
        // When set, the activity embeds Sketchfab's viewer via their
        // Viewer API instead of loading a GLB directly — bypasses the
        // OAuth requirement for downloading models and lets authors
        // use any public CC model on Sketchfab.
        sketchfabUid: z
          .string()
          .regex(/^[a-f0-9]{32}$/i, "Sketchfab UID must be 32 hex characters")
          .optional(),
        scale: z.number().positive().optional(),
        /**
         * Creative Commons / Sketchfab attribution. Rendered in the
         * activity footer when present.
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
      .refine((m) => Boolean(m.src) || Boolean(m.sketchfabUid), {
        message: "model needs either `src` (GLB URL) or `sketchfabUid`",
      }),
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
    lighting: z
      .object({
        // Preset names map to drei's <Environment preset> HDRIs.
        // "studio" is the default neutral white-grey for clinical/medical
        // models; outdoor presets warm up natural-subject models; "sunset"
        // is more dramatic for hero shots.
        preset: z
          .enum(["studio", "warehouse", "park", "forest", "lobby", "sunset"])
          .optional(),
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
