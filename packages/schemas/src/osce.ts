import { z } from "zod";
import { ScoringSchema } from "./scoring.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const Action = z
  .object({
    id: z.string().min(1),
    /** Plain text label for the action (e.g. "Auscultate the chest"). */
    text: z.string().min(1),
    correct: z.boolean(),
    /**
     * Optional weight for this action when scoring. Defaults to 1.
     * Reserved for future use; v1 treats weight as a multiplier on the
     * per-action point but we always score 1 point per correct selection.
     */
    weight: z.number().min(0).optional(),
    /** Inline feedback shown next to the action after submit. */
    feedback: z.string().optional(),
  })
  .strict();

const Phase = z
  .object({
    id: z.string().min(1),
    /** Short name for the phase (e.g. "History"). Shown in the stepper. */
    name: z.string().min(1),
    /** Optional HTML description of the phase — sanitized at render time. */
    description: z.string().optional(),
    actions: z
      .array(Action)
      .min(1)
      .refine(
        (arr) => new Set(arr.map((a) => a.id)).size === arr.length,
        { message: "action ids must be unique within a phase" },
      ),
  })
  .strict();

/**
 * OSCE Clinical Encounter — a simulated patient encounter where the learner
 * works through sequenced phases (history, exam, investigations, management)
 * and is scored on what they did *and* the order they did it in.
 *
 * Per phase: multi-select toggleable actions; partial-credit scoring
 * (`scoreSelection`) aggregated across all phases. If `expectedOrder` is
 * provided, the learner also earns a point for each phase they visited in the
 * expected position.
 */
export const OSCEConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    /**
     * HTML — patient presentation, vitals, and other case-level context.
     * Always visible above the phase area. Sanitized at render.
     */
    caseHeader: z.string().min(1),
    phases: z
      .array(Phase)
      .min(1)
      .refine(
        (arr) => new Set(arr.map((p) => p.id)).size === arr.length,
        { message: "phase ids must be unique" },
      ),
    /**
     * Optional list of phase ids in the expected visit order. When present,
     * each correct position earns 1 point (separate from per-action scoring).
     */
    expectedOrder: z.array(z.string().min(1)).optional(),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        /** When true, learner can click any phase in the stepper to jump there. */
        allowSkipPhase: z.boolean().optional(),
        /**
         * Penalty multiplier applied to each wrong action when scoring a phase.
         * Defaults to 1 (a wrong selection subtracts 1 from the phase's earned
         * points). Set to 0 to remove penalties — wrong picks no longer count
         * against the score. Range: 0..1.
         */
        guessPenalty: z.number().min(0).max(1).optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        nextPhaseButton: z.string().optional(),
        submitButton: z.string().optional(),
        tryAgainButton: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
  })
  .strict()
  .refine(
    (cfg) => {
      if (!cfg.expectedOrder) return true;
      const ids = new Set(cfg.phases.map((p) => p.id));
      return cfg.expectedOrder.every((id) => ids.has(id));
    },
    {
      message: "expectedOrder entries must reference existing phase ids",
      path: ["expectedOrder"],
    },
  );

export type OSCEConfig = z.infer<typeof OSCEConfigSchema>;
