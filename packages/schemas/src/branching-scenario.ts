import { z } from "zod";
import { ScoringSchema } from "./scoring.js";
import { AppearanceSchema } from "./appearance.js";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const Outcome = z
  .object({
    // 0..1 — the runtime emits this as raw with max=1 for SCORM, so
    // out-of-range values would yield unpredictable LMS behavior.
    score: z.number().min(0).max(1),
    success: z.boolean(),
    message: z.string().optional(),
  })
  .strict();

const Choice = z
  .object({
    id: z.string().min(1),
    /** HTML — author-controlled. Sanitized at render. */
    text: z.string().min(1),
    nextNodeId: z.string().min(1),
    /** Optional inline feedback shown after the learner picks this choice. */
    feedback: z.string().optional(),
  })
  .strict();

const Node = z
  .object({
    id: z.string().min(1),
    /** HTML — author-controlled prompt at this decision point. Sanitized at render. */
    prompt: z.string().min(1),
    /**
     * Choices the learner can pick at this node. `null` (or empty) marks the
     * node as terminal — the learner has reached an outcome.
     */
    choices: z.array(Choice).nullable(),
    outcome: Outcome.optional(),
  })
  .strict();

/**
 * Branching Scenario — the learner walks a decision tree of prompt nodes.
 * Each non-terminal node has 1+ choices that route to another node. Terminal
 * nodes (choices=null or empty) carry an optional outcome; the activity
 * completes when one is reached.
 *
 * This is the parent activity for DDx Tree and OSCE — those compose pre-baked
 * node graphs around this same schema.
 */
export const BranchingScenarioConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    nodes: z
      .array(Node)
      .min(1)
      .refine((arr) => new Set(arr.map((n) => n.id)).size === arr.length, {
        message: "node ids must be unique",
      }),
    startNodeId: z.string().min(1),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        restartButton: z.string().optional(),
      })
      .strict()
      .optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.optional(),
  })
  .strict()
  .refine((cfg) => cfg.nodes.some((n) => n.id === cfg.startNodeId), {
    message: "startNodeId must reference an existing node id",
    path: ["startNodeId"],
  })
  .refine(
    (cfg) => {
      const ids = new Set(cfg.nodes.map((n) => n.id));
      return cfg.nodes.every((n) =>
        n.choices === null
          ? true
          : n.choices.every((c) => ids.has(c.nextNodeId)),
      );
    },
    {
      message: "every choice's nextNodeId must reference an existing node id",
      path: ["nodes"],
    },
  )
  .refine(
    (cfg) => {
      // BFS from startNodeId; require at least one terminal node reachable.
      const byId = new Map(cfg.nodes.map((n) => [n.id, n] as const));
      const start = byId.get(cfg.startNodeId);
      if (!start) return false;
      const seen = new Set<string>([cfg.startNodeId]);
      const queue: string[] = [cfg.startNodeId];
      while (queue.length > 0) {
        const id = queue.shift() as string;
        const node = byId.get(id);
        if (!node) continue;
        if (node.choices === null || node.choices.length === 0) return true;
        for (const c of node.choices) {
          if (!seen.has(c.nextNodeId) && byId.has(c.nextNodeId)) {
            seen.add(c.nextNodeId);
            queue.push(c.nextNodeId);
          }
        }
      }
      return false;
    },
    {
      message: "at least one terminal node must be reachable from startNodeId",
      path: ["nodes"],
    },
  );

export type BranchingScenarioConfig = z.infer<typeof BranchingScenarioConfigSchema>;
