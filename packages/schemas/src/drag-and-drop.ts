import { z } from "zod";
import { SAFE_MEDIA_URL } from "./url.js";

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
    author: z.string().optional(),
    // Optional background image. When omitted, the activity renders a
    // plain stage (16:10 aspect-ratio neutral canvas) so authors can
    // build "text table" / labelled-zone puzzles where drop zones do
    // the visual work themselves (e.g. category cells with their own
    // headings). When `src` is provided, `alt` is required for
    // accessibility.
    background: z
      .object({
        src: SAFE_MEDIA_URL,
        alt: z.string().min(1),
      })
      .strict()
      .optional(),
    draggables: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1),
            // Optional per-chip image. If src is provided, alt is required —
            // the label can describe it, but a screen reader still needs an
            // accessible name for the <img> itself.
            image: z
              .object({
                src: SAFE_MEDIA_URL,
                alt: z.string().min(1),
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
        // How the chip-to-zone interaction is driven. "drag" forces the
        // @dnd-kit drag flow; "tap" forces the tap-to-place flow (chip →
        // zone, two taps). "auto" (default) picks per session based on the
        // first observed pointer type — mouse/pen → drag, touch → tap.
        // Below 760 px width the runtime always behaves as "tap" regardless
        // of this setting (mobile drag-on-page-scroll is hostile).
        interaction: z.enum(["drag", "tap", "auto"]).optional(),
        // Board aspect ratio. Authors with portrait-shaped reference art
        // can pick 4/3 or 1/1; default 16/10 matches the existing layout.
        aspectRatio: z.enum(["16/10", "4/3", "1/1"]).optional(),
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
