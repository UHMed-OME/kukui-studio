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

export const DragAndDropConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    background: z
      .object({
        src: z.string().min(1),
        alt: z.string().optional(),
      })
      .strict(),
    draggables: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1),
            image: z
              .object({
                src: z.string().optional(),
                alt: z.string().optional(),
              })
              .strict()
              .optional(),
            correctZones: z.array(z.string()).min(1),
            feedback: z.string().optional(),
          })
          .strict(),
      )
      .min(1),
    dropZones: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().optional(),
            rect: Rect,
            capacity: z.number().int().min(1).optional(),
            showLabel: z.boolean().optional(),
          })
          .strict(),
      )
      .min(1),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        enableSolutionsButton: z.boolean().optional(),
        singlePoint: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        checkAnswerButton: z.string().optional(),
        showSolutionButton: z.string().optional(),
        tryAgainButton: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type DragAndDropConfig = z.infer<typeof DragAndDropConfigSchema>;
