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

const TextElement = z
  .object({
    type: z.literal("text"),
    html: z.string().min(1),
    rect: Rect,
  })
  .strict();

const ImageElement = z
  .object({
    type: z.literal("image"),
    src: z.string().min(1),
    alt: z.string().optional(),
    rect: Rect,
  })
  .strict();

const InteractionElement = z
  .object({
    type: z.literal("interaction"),
    kind: z.enum(["multipleChoice", "fillInTheBlanks"]),
    config: z.record(z.string(), z.unknown()),
    rect: Rect,
  })
  .strict();

const Element = z.discriminatedUnion("type", [TextElement, ImageElement, InteractionElement]);

const Slide = z
  .object({
    title: z.string().optional(),
    background: z
      .object({
        src: z.string().optional(),
        color: z.string().optional(),
      })
      .strict()
      .optional(),
    elements: z.array(Element).min(1),
  })
  .strict();

export const CoursePresentationConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    slides: z.array(Slide).min(1),
    passPercentage: z.number().min(0).max(100).optional(),
    behaviour: z
      .object({
        showProgressBar: z.boolean().optional(),
        showKeywords: z.boolean().optional(),
        enableRetry: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        nextSlideButton: z.string().optional(),
        previousSlideButton: z.string().optional(),
        finishButton: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type CoursePresentationConfig = z.infer<typeof CoursePresentationConfigSchema>;
