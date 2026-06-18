import { z } from "zod";
import { ScoringSchema, AppearanceSchema, SAFE_MEDIA_URL } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * A slide's embedded formative activity. The author picks one of the two
 * supported inner activity kinds; the inner `config` is stored loosely as
 * `z.unknown()` here and validated at render time against the matching
 * activity schema (see Component.tsx) — the same late-validation pattern the
 * interactive-video activity uses for its checkpoint interactions. This keeps
 * the slide-deck schema decoupled from the inner activities' evolving shapes.
 */
const SlideActivity = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("multipleChoice"),
      /** A multiple-choice config; validated at render. */
      config: z.unknown(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("fillInTheBlanks"),
      /** A fill-in-the-blanks config; validated at render. */
      config: z.unknown(),
    })
    .strict(),
]);

/**
 * One slide: prose body (HTML, sanitized at render), an optional image, and
 * an optional embedded formative activity. A slide may carry none of these
 * beyond its title — an interstitial / section divider is valid.
 */
const Slide = z
  .object({
    /** Stable slide id — unique within the deck (drives resume + keys). */
    id: z.string().min(1),
    /** Optional slide heading shown above the body. */
    title: z.string().optional(),
    /** Slide prose as HTML. Sanitized at render via SafeHtml. */
    body: z.string().optional(),
    /** Optional illustrative image. */
    media: z
      .object({
        src: SAFE_MEDIA_URL,
        /** Required accessible name for the image (WCAG 1.1.1). */
        alt: z.string().min(1),
        caption: z.string().optional(),
      })
      .strict()
      .optional(),
    /** Optional embedded multiple-choice / fill-in-the-blanks activity. */
    activity: SlideActivity.optional(),
  })
  .strict();

/**
 * Course Presentation — a navigable slide deck where each slide pairs content
 * (prose + optional image) with an optional embedded formative activity
 * (multiple choice or fill in the blanks).
 *
 * Learning objective: "Move through a sequenced set of slides at your own
 * pace, study the content on each, and answer the embedded check-for-
 * understanding activities — building toward the slide deck's overall
 * concept." The embedded activities are the scorable surface; the author
 * selects points / all-or-nothing / completion via Studio's Scoring tab (the
 * `scoring` block). A deck with no embedded activities is completion-only:
 * reaching the end marks it complete.
 */
export const CoursePresentationConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    slides: z
      .array(Slide)
      .min(1)
      .refine((arr) => new Set(arr.map((s) => s.id)).size === arr.length, {
        message: "slide ids must be unique",
      }),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict();

export type CoursePresentationConfig = z.infer<typeof CoursePresentationConfigSchema>;
