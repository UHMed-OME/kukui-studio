import { z } from "zod";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const Position = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  })
  .strict();

const SeedNode = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    position: Position,
  })
  .strict();

const PaletteConcept = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
  })
  .strict();

const ExpectedEdge = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    label: z.string().optional(),
  })
  .strict();

/**
 * Concept Map / Node-Link Builder — the learner constructs a node-link diagram
 * of relationships between concepts. Drag nodes onto a canvas, draw edges
 * between them, label both. Async-mode v1; the real-time multi-learner version
 * arrives in Live (Phase 3).
 *
 * Authors can pre-place `seedNodes` (already on the canvas at fixed positions),
 * provide a palette of `availableConcepts` learners drag in, and/or set
 * `behaviour.allowFreeText` to let learners type labels for nodes they invent
 * themselves. `expected` is the optional answer key; when present, scoring is
 * `(correct nodes present + correct edges present) / total`. Without it the
 * activity is completion-only.
 */
export const ConceptMapConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    /** HTML — author-controlled prompt. Sanitized at render. */
    prompt: z.string().min(1),
    seedNodes: z.array(SeedNode).optional(),
    availableConcepts: z.array(PaletteConcept).optional(),
    expected: z
      .object({
        nodes: z.array(z.string().min(1)).optional(),
        edges: z.array(ExpectedEdge).optional(),
      })
      .strict()
      .optional(),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        /** When true, learners can create nodes by typing labels (free text). */
        allowFreeText: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        submitButtonLabel: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type ConceptMapConfig = z.infer<typeof ConceptMapConfigSchema>;
