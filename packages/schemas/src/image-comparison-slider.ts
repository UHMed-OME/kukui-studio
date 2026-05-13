import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";
import { SAFE_MEDIA_URL } from "./url.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const ImageSchema = z
  .object({
    src: SAFE_MEDIA_URL,
    alt: z.string().min(1),
    caption: z.string().optional(),
  })
  .strict();

/**
 * Image Comparison Slider — learner drags a vertical seam between a "before"
 * and "after" image to reveal each side. This activity is completion-only:
 * looking at it counts as doing it. The component reports `raw=1, max=1` on
 * Done.
 */
export const ImageComparisonSliderConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    /** HTML prompt rendered above the comparison surface. */
    prompt: z.string().min(1),
    // Both images are optional at the schema level — runtime renders an
    // "add a before / after image" empty state when missing. Slider works
    // as soon as both are set.
    before: ImageSchema.optional(),
    after: ImageSchema.optional(),
    /** Initial seam position 0..1 (0 = full "after", 1 = full "before"). Default 0.5. */
    initialPosition: z.number().min(0).max(1).optional(),
    /**
     * Optional checkpoint questions tied to specific seam positions. Authors
     * can use these to guide the learner to focal points in the imagery.
     * v1 just renders them as captions; future versions may gate completion.
     */
    prompts: z
      .array(
        z
          .object({
            position: z.number().min(0).max(1),
            question: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
    behaviour: z
      .object({
        /** Seam returns to 0.5 when the learner releases the handle. */
        autoSnap: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        doneButton: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.optional(),
  })
  .strict();

export type ImageComparisonSliderConfig = z.infer<typeof ImageComparisonSliderConfigSchema>;
