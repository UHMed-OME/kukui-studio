import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";
import { SAFE_MEDIA_URL } from "./url.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const Vector3 = z.object({ x: z.number(), y: z.number(), z: z.number() }).strict();

const TextContent = z
  .object({ type: z.literal("text"), html: z.string().min(1) })
  .strict();

const ImageContent = z
  .object({
    type: z.literal("image"),
    src: SAFE_MEDIA_URL,
    alt: z.string().min(1),
    caption: z.string().optional(),
  })
  .strict();

const AudioContent = z
  .object({
    type: z.literal("audio"),
    src: SAFE_MEDIA_URL,
    autoplay: z.boolean().optional(),
    loop: z.boolean().optional(),
    caption: z.string().optional(),
  })
  .strict();

const ContentItem = z.discriminatedUnion("type", [TextContent, ImageContent, AudioContent]);

export const VirtualTourConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    scene: z
      .object({
        src: SAFE_MEDIA_URL,
        spawn: z
          .object({
            position: Vector3,
          })
          .strict()
          .optional(),
      })
      .strict(),
    movement: z
      .object({
        speed: z.number().positive().optional(),
      })
      .strict()
      .optional(),
    overlays: z
      .array(
        z
          .object({
            id: z.string().min(1),
            position: Vector3,
            trigger: z.enum(["click"]).optional(),
            title: z.string().optional(),
            content: z.array(ContentItem).min(1),
          })
          .strict(),
      )
      .min(1),
    completion: z
      .object({
        mode: z.enum(["visitAll", "manual"]).optional(),
        requiredOverlayIds: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        doneButton: z.string().optional(),
        closeOverlayButton: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.optional(),
  })
  .strict();

export type VirtualTourConfig = z.infer<typeof VirtualTourConfigSchema>;
