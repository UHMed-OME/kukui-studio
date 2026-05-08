import { z } from "zod";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const Diagnosis = z
  .object({
    name: z.string().min(1),
    correct: z.boolean(),
    /** 0..1 score awarded when this terminal is reached. */
    score: z.number().min(0).max(1),
    /** Optional HTML rationale shown alongside the diagnosis. */
    explanation: z.string().optional(),
  })
  .strict();

const Choice = z
  .object({
    id: z.string().min(1),
    /** HTML — author-controlled label for this investigation/test/diagnosis option. */
    text: z.string().min(1),
    nextNodeId: z.string().min(1),
    /**
     * HTML — when this choice is taken, append this fragment to the running
     * "Case so far" panel. Models the clinical detail that picking the test
     * (or moving to the next reasoning step) reveals.
     */
    addsToCase: z.string().optional(),
    /** Optional inline feedback shown after this choice is picked. */
    feedback: z.string().optional(),
  })
  .strict();

const Node = z
  .object({
    id: z.string().min(1),
    /** HTML — author-controlled prompt at this decision point. */
    presentation: z.string().min(1),
    /**
     * Choices the learner can pick. `null` (or empty) marks a terminal node;
     * a terminal node MUST carry a `diagnosis`.
     */
    choices: z.array(Choice).nullable(),
    diagnosis: Diagnosis.optional(),
  })
  .strict();

/**
 * Differential Diagnosis Tree — the learner walks a diagnostic decision tree.
 * At each node a clinical case detail is added (via the picked choice's
 * `addsToCase`) and they choose the next investigation/test/diagnosis. Reaching
 * a terminal node (`diagnosis` set) yields the final score.
 *
 * Structurally similar to Branching Scenario but with domain semantics: a
 * persistent case header, an accumulating case-so-far panel, and diagnosis
 * outcomes rather than generic outcomes.
 */
export const DDxTreeConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    /** HTML — initial case presentation: chief complaint, vitals, etc. */
    caseHeader: z.string().min(1),
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
    (cfg) =>
      cfg.nodes.every((n) => {
        const isTerminal = n.choices === null || n.choices.length === 0;
        return isTerminal ? n.diagnosis !== undefined : true;
      }),
    {
      message: "every terminal node (no choices) must carry a diagnosis",
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

export type DDxTreeConfig = z.infer<typeof DDxTreeConfigSchema>;
