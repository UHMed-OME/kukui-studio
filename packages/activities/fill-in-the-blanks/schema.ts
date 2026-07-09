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
      // Parse-based checks (not a regex) so escaped asterisks (`\*`) never
      // count as blank markers. Custom refinements are ignored by
      // z.toJSONSchema, so Studio still gets these errors via the Zod
      // extraErrors merge, not AJV.
      .refine((raw) => parseClozeText(raw).some((s) => s.kind === "blank"), {
        message: "text must contain at least one *blank* marker",
      })
      .refine(
        (raw) =>
          parseClozeText(raw).every((s) => s.kind !== "blank" || s.accepts.length > 0),
        {
          message:
            "every *blank* must contain at least one accepted answer — empty markers like ** or *|* are not allowed",
        },
      ),
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
 * Each blank is wrapped in asterisks: `*answer*`, or `*opt1|opt2*` for
 * alternates (`|` is the ONLY separator — `/` is a literal character, so
 * answers like "mg/dL" are authorable). A literal asterisk in passage text
 * or inside a blank is written as `\*`. An unmatched `*` with no closing
 * marker stays literal text. Returns an alternating sequence of `{ text }`
 * segments and `{ accepts: string[] }` blanks. The first segment is always
 * text (possibly empty), so the array always begins and ends with a text
 * segment.
 */
export function parseClozeText(
  raw: string,
): Array<{ kind: "text"; text: string } | { kind: "blank"; accepts: string[] }> {
  const parts: Array<{ kind: "text"; text: string } | { kind: "blank"; accepts: string[] }> = [];
  let text = "";
  /** Blank content being accumulated; null while outside a blank. */
  let blank: string | null = null;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]!;
    if (ch === "\\" && raw[i + 1] === "*") {
      // Escaped asterisk — a literal `*`, never a blank delimiter.
      if (blank === null) text += "*";
      else blank += "*";
      i += 1;
      continue;
    }
    if (ch === "*") {
      if (blank === null) {
        blank = "";
      } else {
        parts.push({ kind: "text", text });
        text = "";
        const accepts = blank
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean);
        parts.push({ kind: "blank", accepts });
        blank = null;
      }
      continue;
    }
    if (blank === null) text += ch;
    else blank += ch;
  }
  if (blank !== null) {
    // Unterminated marker: the lone `*` and everything after it are literal.
    text += `*${blank}`;
  }
  parts.push({ kind: "text", text });
  return parts;
}
