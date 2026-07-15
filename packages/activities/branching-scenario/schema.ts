import { z } from "zod";
import { ScoringSchema, AppearanceSchema, SAFE_MEDIA_URL } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * An optional image on a node or an outcome. Same asset model as
 * course-presentation slide backgrounds: the bytes live outside the config
 * (IndexedDB keyed by `assetId` in Studio, a transient object-URL `src` for
 * preview), and at SCORM/web export the blob is bundled and `src` rewritten to
 * a relative `./assets/<assetId>.png`. So `src` is optional until previewed or
 * exported.
 */
const NodeImage = z
  .object({
    /** IndexedDB asset key (Studio authoring). Absent once fully external. */
    assetId: z.string().min(1).optional(),
    /** Resolved media URL: object URL (preview), relative path (export), or https. */
    src: SAFE_MEDIA_URL.optional(),
    /** Required accessible name. */
    alt: z.string().min(1),
    /** Natural pixel dimensions, used to size the image at its real aspect. */
    naturalWidth: z.number().positive(),
    naturalHeight: z.number().positive(),
  })
  .strict();

/**
 * An optional video on a node: a YouTube link or an uploaded / hosted file.
 * Same asset model as images — an uploaded file's bytes live in IndexedDB
 * (keyed by `assetId` in Studio) and are bundled at SCORM/web export with
 * `src` rewritten to a relative path; a YouTube link is just its `src`.
 * Rendered above the prompt so the learner watches, then chooses.
 */
const NodeVideo = z
  .object({
    /** "youtube" for a share/watch link, "html5" for an uploaded/hosted file. */
    type: z.enum(["youtube", "html5"]),
    /** IndexedDB asset key for uploaded files (Studio authoring). */
    assetId: z.string().min(1).optional(),
    /** Resolved URL: YouTube link, object URL (preview), relative path (export),
     *  or https. Optional: an uploaded file has only an `assetId` until it is
     *  resolved for preview or bundled at export. */
    src: SAFE_MEDIA_URL.optional(),
    /** Optional accessible title / caption. */
    title: z.string().optional(),
  })
  .strict();

const Outcome = z
  .object({
    // 0..1 — used as the SCORM score in "terminal" scoreMode (raw, max=1).
    // Ignored in "path" scoreMode, where points accumulate along the route.
    score: z.number().min(0).max(1),
    success: z.boolean(),
    /** Optional end-screen heading (e.g. "Well handled"). Plain text. */
    title: z.string().optional(),
    /** Optional end-screen body. HTML, sanitized at render. */
    message: z.string().optional(),
    /** Optional end-screen image. */
    image: NodeImage.optional(),
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
    /**
     * Points this choice contributes in "path" scoreMode (default 0). Ignored
     * in "terminal" scoreMode. See the scoreMode note on the config below.
     */
    points: z.number().min(0).optional(),
  })
  .strict();

const Node = z
  .object({
    id: z.string().min(1),
    /** HTML — author-controlled prompt at this decision point. Sanitized at render. */
    prompt: z.string().min(1),
    /** Optional image shown above the prompt. */
    image: NodeImage.optional(),
    /** Optional video shown above the prompt (YouTube link or uploaded file). */
    video: NodeVideo.optional(),
    /**
     * Optional normalized (0..1) canvas position for the Studio graph editor.
     * Pure authoring metadata; the runtime ignores it.
     */
    position: z
      .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
      .strict()
      .optional(),
    /**
     * Choices the learner can pick at this node. `null` (or empty) marks the
     * node as terminal — the learner has reached an outcome.
     */
    choices: z.array(Choice).nullable(),
    outcome: Outcome.optional(),
  })
  .strict();

/**
 * Branching Scenario — the learner walks a decision tree of nodes. Each node
 * shows an optional image plus an HTML prompt; non-terminal nodes offer 1+
 * choices that route to another node, terminal nodes (choices=null or empty)
 * show an end screen (outcome title / message / image). The activity completes
 * when a terminal node is reached.
 *
 * Scoring is set by `behaviour.scoreMode`:
 *   - "terminal" (default): the score is the terminal node's `outcome.score`
 *     (0..1), emitted as raw with max=1. Today's behavior.
 *   - "path": each picked choice's `points` are summed. Raw = points earned;
 *     max = the best attainable on the route the learner actually walked (the
 *     sum, at each visited node, of the highest-points choice there). Success
 *     follows the resolved pass threshold.
 *
 * DDx Tree and OSCE are separate activities with their own schemas; they
 * resemble this tree but do not share code with it.
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
        /** How the score is computed. Default "terminal". See the config note. */
        scoreMode: z.enum(["terminal", "path"]).optional(),
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
    appearance: AppearanceSchema.default({ theme: "auto" }),
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
