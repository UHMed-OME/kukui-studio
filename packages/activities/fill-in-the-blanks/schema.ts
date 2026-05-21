import { z } from "zod";
import { ScoringSchema, AppearanceSchema } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

export const FillInTheBlanksConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    text: z
      .string()
      .min(1)
      .regex(/\*[^*]+\*/, { message: "text must contain at least one *blank* marker" }),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        caseSensitive: z.boolean().optional(),
        acceptSpellingErrors: z.boolean().optional(),
        showSolutionsButton: z.boolean().optional(),
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
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict();

export type FillInTheBlanksConfig = z.infer<typeof FillInTheBlanksConfigSchema>;

/**
 * Parses a cloze text into static segments and blank slots.
 *
 * Each blank is wrapped in asterisks: `*answer*` or `*opt1/opt2*` or
 * `*opt1|opt2*` for alternates. Returns an alternating sequence of
 * `{ text }` segments and `{ accepts: string[] }` blanks. The first segment
 * is always text (possibly empty), so the array always begins and ends
 * with a text segment.
 */
export function parseClozeText(
  raw: string,
): Array<{ kind: "text"; text: string } | { kind: "blank"; accepts: string[] }> {
  const matches = [...raw.matchAll(/\*([^*]+)\*/g)];
  const parts: Array<{ kind: "text"; text: string } | { kind: "blank"; accepts: string[] }> = [];
  let cursor = 0;
  for (const match of matches) {
    const start = match.index ?? 0;
    parts.push({ kind: "text", text: raw.slice(cursor, start) });
    const inside = match[1] ?? "";
    const accepts = inside
      .split(/[|/]/g)
      .map((s) => s.trim())
      .filter(Boolean);
    parts.push({ kind: "blank", accepts });
    cursor = start + match[0].length;
  }
  parts.push({ kind: "text", text: raw.slice(cursor) });
  return parts;
}
