import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";
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
    // `draggables` and `correctZones` are allowed to be empty so that
    // an author who just hit Reset or is in the middle of restructuring
    // (delete-all, re-add) doesn't trip a hard schema rejection that
    // hides the activity preview. The Studio chip panel surfaces an
    // inline warning when a chip has no `correctZones`; the runtime
    // treats such a chip as "never correct" (it'll always score wrong
    // wherever placed). Same idea for dropZones — an empty board is a
    // legitimate transient state during authoring.
    draggables: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1),
            correctZones: z.array(z.string()),
            feedback: z.string().optional(),
          })
          .strict(),
      ),
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
      ),
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
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.optional(),
  })
  .strict();

export type DragAndDropConfig = z.infer<typeof DragAndDropConfigSchema>;
