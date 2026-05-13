import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";
import { SAFE_MEDIA_URL } from "./url.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * Normalized 0..1 point on the underlying image. Targets are rendered as
 * small circles centred on (x, y); the consuming component decides the
 * pixel diameter (e.g. 32 px) so the click target meets WCAG 2.5.5.
 */
const Point = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  })
  .strict();

export const AnatomyLabelingConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    /** Author prompt rendered via SafeHtml. */
    prompt: z.string().min(1),
    // Image is optional at the schema level — runtime renders an
    // "add an image" empty state when missing. When present, both `src`
    // and `alt` are required: alt is the description SR learners hear.
    image: z
      .object({
        src: SAFE_MEDIA_URL,
        alt: z.string().min(1),
      })
      .strict()
      .optional(),
    labels: z
      .array(
        z
          .object({
            id: z.string().min(1),
            text: z.string().min(1),
            correctTargetId: z.string().min(1),
          })
          .strict(),
      )
      .min(2),
    targets: z
      .array(
        z
          .object({
            id: z.string().min(1),
            position: Point,
          })
          .strict(),
      )
      .min(2),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        singlePoint: z.boolean().optional(),
        randomizeLabels: z.boolean().optional(),
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
  .refine(
    (c) => {
      const ids = new Set(c.targets.map((t) => t.id));
      return c.labels.every((l) => ids.has(l.correctTargetId));
    },
    { message: "Every label.correctTargetId must reference a target id" },
  );

export type AnatomyLabelingConfig = z.infer<typeof AnatomyLabelingConfigSchema>;
