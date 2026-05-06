import { z } from "zod";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

export const CategorizationConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    /** Author prompt rendered via SafeHtml. */
    prompt: z.string().min(1),
    items: z
      .array(
        z
          .object({
            id: z.string().min(1),
            text: z.string().min(1),
            correctCategory: z.string().min(1),
          })
          .strict(),
      )
      .min(2),
    categories: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1),
          })
          .strict(),
      )
      .min(2),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        singlePoint: z.boolean().optional(),
        randomizeItems: z.boolean().optional(),
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
  })
  .strict()
  .refine(
    (c) => {
      const ids = new Set(c.categories.map((cat) => cat.id));
      return c.items.every((it) => ids.has(it.correctCategory));
    },
    { message: "Every item.correctCategory must reference a category id" },
  );

export type CategorizationConfig = z.infer<typeof CategorizationConfigSchema>;
