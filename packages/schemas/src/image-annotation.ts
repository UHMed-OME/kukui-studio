import { z } from "zod";

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
    prompt: z.string().min(1),
    image: z
      .object({
        src: z.string().min(1),
        alt: z.string().optional(),
      })
      .strict(),
    tools: z
      .object({
        rectangle: z.boolean().optional(),
        circle: z.boolean().optional(),
        arrow: z.boolean().optional(),
        freehand: z.boolean().optional(),
        text: z.boolean().optional(),
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
        allowEdit: z.boolean().optional(),
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
  })
  .strict();

export type ImageAnnotationConfig = z.infer<typeof ImageAnnotationConfigSchema>;
