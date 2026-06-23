import { z } from "zod";
import { ScoringSchema, AppearanceSchema, SAFE_MEDIA_URL } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * A normalized placement rect (0..1 of the slide) for an overlay. Resolution
 * independent so the same deck lays out correctly whether the slide image
 * renders at 400px or 1600px wide. Mirrors the rect convention used by the
 * 2D placement editors (hotspot-2d, image-annotation).
 */
const Rect = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .strict();

/**
 * One positioned interaction on a slide. The author picks one of the two
 * overlay kinds:
 *   - `info`     — a click-to-reveal hotspot showing sanitized HTML.
 *   - `checkpoint` — an embedded multiple-choice / fill-in-the-blanks. Its
 *     inner `config` is stored loosely as `z.unknown()` here and validated at
 *     render against the matching activity schema (see Component.tsx) — the
 *     same late-validation pattern interactive-video uses for its checkpoint
 *     interactions. `required` checkpoints gate advancing past the slide.
 */
const Overlay = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("info"),
      id: z.string().min(1),
      rect: Rect,
      /** Visible label on the hotspot button (also its accessible name). */
      label: z.string().min(1),
      /** Revealed content as HTML. Sanitized at render via SafeHtml. */
      html: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("checkpoint"),
      id: z.string().min(1),
      rect: Rect,
      /** When true, the learner must answer before Next is enabled. */
      required: z.boolean().optional(),
      activity: z
        .object({
          kind: z.enum(["multipleChoice", "fillInTheBlanks"]),
          /** Inner activity config; validated at render. */
          config: z.unknown(),
        })
        .strict(),
    })
    .strict(),
]);

/**
 * A slide's background. Imported decks (PDF / PowerPoint / Google Slides) and
 * uploaded images resolve to `image`; `blank` is a title / section divider.
 *
 * For `image`, the bytes live outside the config: in Studio they sit in
 * IndexedDB keyed by `assetId`, and a transient object-URL `src` is injected
 * for preview. At SCORM/web export the blob is bundled and `src` is rewritten
 * to a relative `./assets/<assetId>.png`. So `src` is optional — a freshly
 * imported slide may carry only `assetId` until it is previewed or exported.
 */
const Background = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("image"),
      /** IndexedDB asset key (Studio authoring). Absent once fully external. */
      assetId: z.string().min(1).optional(),
      /** Resolved media URL: object URL (preview), relative path (export), or https. */
      src: SAFE_MEDIA_URL.optional(),
      /** Required accessible name — extracted slide text or author-edited. */
      alt: z.string().min(1),
      /** Natural pixel dimensions, used to size the slide at its real aspect. */
      naturalWidth: z.number().positive(),
      naturalHeight: z.number().positive(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("blank"),
    })
    .strict(),
]);

/**
 * One slide: a background (imported image or blank divider), an optional
 * accessible notes region (extracted slide text or author prose), and a set of
 * positioned overlays. A slide may carry no overlays — a plain content slide is
 * valid.
 */
const Slide = z
  .object({
    /** Stable slide id — unique within the deck (drives resume + keys). */
    id: z.string().min(1),
    /** Optional slide heading shown above the slide. */
    title: z.string().optional(),
    background: Background,
    /** Optional accessible text for the slide (HTML, sanitized at render). */
    notes: z.string().optional(),
    overlays: z
      .array(Overlay)
      .default([])
      .refine((arr) => new Set(arr.map((o) => o.id)).size === arr.length, {
        message: "overlay ids must be unique within a slide",
      }),
  })
  .strict();

/**
 * Course Presentation — a navigable deck of slide images (imported from PDF /
 * PowerPoint / Google Slides, or blank dividers) where each slide can carry
 * positioned interactions: click-to-reveal info hotspots and embedded
 * multiple-choice / fill-in-the-blanks checkpoints.
 *
 * Learning objective: "Move through a sequenced set of slides at your own pace,
 * study each, explore the hotspots, and answer the embedded checkpoints —
 * building toward the deck's overall concept." The checkpoints are the scorable
 * surface; the author selects points / all-or-nothing / completion via Studio's
 * Scoring tab (the `scoring` block). A deck with no checkpoints is
 * completion-only: reaching the end marks it complete.
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
