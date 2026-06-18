import { z } from "zod";
import { ScoringSchema, AppearanceSchema, SAFE_MEDIA_URL } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

/**
 * One vital sign reading. `flag` drives a token-based color accent that is
 * always paired with `flagText` (and an icon at render) so color is never the
 * sole signal.
 */
const Vital = z
  .object({
    /** The measured value, e.g. "144/67" or "97.6°F". */
    value: z.string().min(1),
    /** What was measured, e.g. "BP (mmHg)". */
    label: z.string().min(1),
    /** Clinical significance band — normal, watch (borderline), or alert. */
    flag: z.enum(["normal", "watch", "alert"]).default("normal"),
    /** Short word shown beside the value, e.g. "Elevated SBP". */
    flagText: z.string().optional(),
  })
  .strict();

/**
 * A physical-exam finding. `type` marks whether the finding is present,
 * notably absent (a pertinent negative), or neutral context. `text` is HTML,
 * sanitized at render.
 */
const ExamFinding = z
  .object({
    type: z.enum(["present", "absent", "neutral"]).default("neutral"),
    text: z.string().min(1),
  })
  .strict();

const Presentation = z
  .object({
    /** Short section badge, e.g. "Clinical Presentation". */
    label: z.string().optional(),
    title: z.string().min(1),
    /** HTML intro shown under the section title. */
    lead: z.string().optional(),
    /** HTML — the chief complaint / history of present illness. */
    chiefComplaint: z.string().min(1),
    vitals: z.array(Vital).default([]),
    examFindings: z.array(ExamFinding).default([]),
    /** Lab values as HTML rows. */
    labResults: z.array(z.object({ text: z.string().min(1) }).strict()).optional(),
    /** HTML cue shown in the "stop and think" callout. */
    reflectionPrompt: z.string().optional(),
  })
  .strict();

const Anatomy = z
  .object({
    label: z.string().optional(),
    title: z.string().min(1),
    lead: z.string().optional(),
    /** HTML — the key imaging finding narrative. */
    imagingFinding: z.string().optional(),
    /**
     * Optional anatomy diagram — either a hosted image (`src`) or inline
     * `svg` markup (rendered through @kukui/core's SafeSvg, which strips
     * scripts/handlers/foreignObject). Provide at least one of the two.
     */
    diagram: z
      .object({
        /** Hosted image URL. */
        src: SAFE_MEDIA_URL.optional(),
        /** Inline SVG source. Sanitized at render. */
        svg: z.string().min(1).optional(),
        /** Required alt / accessible name for the diagram (WCAG 1.1.1). */
        alt: z.string().min(1),
        caption: z.string().optional(),
      })
      .strict()
      .refine((d) => Boolean(d.src) || Boolean(d.svg), {
        message: "diagram needs either an image src or inline svg",
      })
      .optional(),
    /**
     * Plain-text legend entries. Optional `tone` maps the swatch to a
     * design token (color is paired with the label, never the sole signal).
     */
    diagramLegend: z
      .array(
        z
          .object({
            label: z.string().min(1),
            tone: z
              .enum(["primary", "success", "error", "warning", "info", "neutral"])
              .optional(),
          })
          .strict(),
      )
      .optional(),
    /** Expandable anatomical-space cards: a name and an HTML detail body. */
    spaces: z
      .array(z.object({ name: z.string().min(1), detail: z.string().min(1) }).strict())
      .optional(),
    /** Key anatomy notes. `highlight` calls out the most load-bearing note. */
    notes: z
      .array(
        z
          .object({ highlight: z.boolean().optional(), text: z.string().min(1) })
          .strict(),
      )
      .optional(),
  })
  .strict();

const Diagnosis = z
  .object({
    label: z.string().optional(),
    title: z.string().min(1),
    lead: z.string().optional(),
    /** HTML — the pathognomonic / key diagnostic finding. */
    keyFinding: z.string().optional(),
    /**
     * Differential items. `verdict: "in"` = confirmed/ruled-in,
     * `"out"` = excluded. Rendered with icon + text, not color alone.
     */
    differential: z
      .array(
        z.object({ verdict: z.enum(["in", "out"]), text: z.string().min(1) }).strict(),
      )
      .optional(),
    /** Aetiology tags shown as a chip list. */
    causes: z.array(z.string().min(1)).optional(),
    /** Management steps. `urgent` marks priority actions. `text` is HTML. */
    management: z
      .array(
        z
          .object({ urgent: z.boolean().optional(), text: z.string().min(1) })
          .strict(),
      )
      .optional(),
    /** References as HTML strings (citations may carry <em> for journal titles). */
    references: z.array(z.string().min(1)).optional(),
  })
  .strict();

const Question = z
  .object({
    id: z.string().min(1),
    /** The question stem (plain text). */
    question: z.string().min(1),
    /** Answer options in order. Index 0 = first option. */
    options: z.array(z.string().min(1)).min(2),
    /** 0-based index of the correct option. */
    correctIndex: z.number().int().min(0),
    /**
     * One feedback string per option, in the same order as `options`. The
     * highest-leverage teaching moment — reinforce the correct pick and
     * redirect each distractor.
     */
    feedbackPerOption: z.array(z.string()).optional(),
  })
  .strict()
  .refine((q) => q.correctIndex < q.options.length, {
    message: "correctIndex must reference an existing option",
    path: ["correctIndex"],
  })
  .refine((q) => !q.feedbackPerOption || q.feedbackPerOption.length === q.options.length, {
    message: "feedbackPerOption must have one entry per option",
    path: ["feedbackPerOption"],
  });

const Quiz = z
  .object({
    label: z.string().optional(),
    title: z.string().optional(),
    lead: z.string().optional(),
    questions: z
      .array(Question)
      .min(1)
      .refine((arr) => new Set(arr.map((q) => q.id)).size === arr.length, {
        message: "question ids must be unique",
      }),
    /**
     * Optional messages indexed by number-correct (0..questions.length).
     * When present, the message at index = #correct is shown after submit.
     */
    scoreMessages: z.array(z.string()).optional(),
  })
  .strict();

const Activity = z
  .object({
    label: z.string().optional(),
    title: z.string().optional(),
    lead: z.string().optional(),
    /** Required learning objectives shown as a self-check rubric. */
    objectives: z
      .array(
        z.object({ text: z.string().min(1), hint: z.string().optional() }).strict(),
      )
      .optional(),
    /** Where the deliverable is submitted, e.g. "Brightspace → Assignments". */
    submissionPlatform: z.string().optional(),
    /** Selectable deliverable formats. `guidance`/`submission` are HTML. */
    formats: z
      .array(
        z
          .object({
            id: z.string().min(1),
            /** Optional leading glyph (emoji). */
            icon: z.string().optional(),
            name: z.string().min(1),
            desc: z.string().optional(),
            guidance: z.string().min(1),
            submission: z.string().optional(),
          })
          .strict(),
      )
      .min(1)
      .refine((arr) => new Set(arr.map((f) => f.id)).size === arr.length, {
        message: "format ids must be unique",
      }),
  })
  .strict();

/**
 * Clinical Anatomy Case — a guided, multi-section clinical case.
 *
 * Learning objective: "Work through a clinical anatomy case end to end:
 * interpret the patient presentation and imaging findings, justify a
 * differential diagnosis from the underlying anatomy, and choose how to
 * demonstrate that reasoning."
 *
 * The learner steps through Presentation → Anatomy → Diagnosis → a formative
 * multiple-choice Quiz (immediate per-option feedback) → an Activity chooser
 * describing the graded deliverable. The quiz is the scorable surface; the
 * author selects points / all-or-nothing / completion via Studio's Scoring
 * tab (the `scoring` block), so the component honors whichever mode is set.
 */
export const ClinicalCaseConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    /**
     * Optional header icon — an emoji (e.g. "🩺") or a token-glyph code
     * `glyph:<name>:<tone>`. Authored via Studio's icon picker, rendered by
     * @kukui/core's <ActivityIcon>.
     */
    icon: z.string().optional(),
    /** Course code, e.g. "MDED-556L". Shown in the case header. */
    course: z.string().optional(),
    school: z.string().optional(),
    /** Module label, e.g. "Week 1". */
    week: z.string().optional(),
    presentation: Presentation,
    anatomy: Anatomy,
    diagnosis: Diagnosis,
    quiz: Quiz,
    /** Optional assignment-format chooser. Omit for a read-and-quiz-only case. */
    activity: Activity.optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict();

export type ClinicalCaseConfig = z.infer<typeof ClinicalCaseConfigSchema>;
