/**
 * RJSF uiSchema for the ddx-tree activity. Drives Studio's form editor —
 * field order, labels, help text, widget choices. Hand-tuned; cannot be
 * auto-derived from Zod alone because RJSF needs designer decisions about
 * layout and copy.
 *
 * Extracted from apps/studio-app/src/uiSchemas.ts. The COMMON / TITLE /
 * AUTHOR / HIDDEN / BEHAVIOUR_RETRY / f() identifiers from that file are
 * inlined here as local constants so this module is standalone.
 */

const HIDDEN = { "ui:widget": "hidden" } as const;

/** Compact builder: f(label, help, opts?) → uiSchema fragment for a leaf field. */
function f(title: string, help?: string, extra: Record<string, unknown> = {}) {
  return {
    "ui:title": title,
    ...(help ? { "ui:help": help } : {}),
    ...extra,
  };
}

/**
 * Shared uiSchema for the `appearance` block (theme pin). Mirrors the
 * COMMON.APPEARANCE fragment from apps/studio-app/src/uiSchemas.ts so the
 * "Appearance" section renders identically here.
 */
const APPEARANCE = {
  "ui:title": "Appearance",
  "ui:help":
    "Pin a color scheme for this activity. \"Auto\" follows the learner's OS preference.",
  theme: f(
    "Color scheme",
    "How the activity looks on the learner's screen. \"Auto\" lets the OS decide (light/dark); pick a specific scheme to override regardless of the learner's preference.",
  ),
} as const;

const COMMON = {
  version: HIDDEN,
  _comment: HIDDEN,
  $schema: HIDDEN,
  appearance: APPEARANCE,
} as const;

const TITLE = f(
  "Activity title",
  "Shown at the top of the activity and as the SCORM activity name.",
);

const AUTHOR = f(
  "Author (optional)",
  "Your name. Shown in the small credit line at the bottom of the activity.",
);

// After the Scoring tab landed, retry lives there. Kept as `HIDDEN` so the
// legacy schema field doesn't render in the Editor form — it's owned by
// the Scoring tab now.
const BEHAVIOUR_RETRY = HIDDEN;

const uiSchema = {
  ...COMMON,
  "ui:order": ["title", "startNodeId", "nodes", "behaviour", "ui", "*"],
  title: TITLE,
  author: AUTHOR,
  startNodeId: f("Starting step", "First presentation the learner sees.", {
    "ui:widget": "nodeSelect",
  }),
  nodes: {
    "ui:title": "Differential diagnosis steps",
    "ui:help":
      "Each step has a clinical presentation, then a list of choices that lead elsewhere or a final diagnosis.",
    items: {
      id: HIDDEN,
      presentation: f(
        "Presentation",
        "Vignette / patient context shown at this step.",
        { "ui:widget": "html" },
      ),
      choices: {
        "ui:title": "Choices",
        "ui:help":
          "Leave Choices empty on the final step(s) of a branch — those are terminal steps and need a Final diagnosis instead.",
        items: {
          id: HIDDEN,
          text: f("Choice text"),
          nextNodeId: f("Goes to step", "Which step this choice leads to.", {
            "ui:widget": "nodeSelect",
          }),
          addsToCase: f(
            "Adds to 'Case so far' (optional)",
            "HTML fragment appended to the running case panel when the learner picks this choice. Models the new clinical detail the picked test reveals.",
            { "ui:widget": "html" },
          ),
          feedback: f("Feedback (optional)", undefined, {
            "ui:widget": "textarea",
            "ui:options": { rows: 2 },
          }),
        },
      },
      diagnosis: {
        "ui:title": "Final diagnosis (terminal step only)",
        "ui:help":
          "Required when this step has no choices — the diagnosis the learner reaches at the end of this branch. Empty name auto-fills with a 'New diagnosis' placeholder so the activity stays valid while you're authoring.",
        name: f(
          "Diagnosis name",
          "Display name shown when the learner reaches this terminal step.",
        ),
        correct: f(
          "Correct diagnosis?",
          "Whether reaching this terminal represents correct reasoning. Drives the success/failure outcome reported to the LMS.",
        ),
        score: f(
          "Score (0–1)",
          "0 = fully wrong path, 1 = textbook reasoning. Maps directly to the 0..1 score reported to SCORM.",
          {
            "ui:widget": "updown",
            "ui:options": { step: 0.1, min: 0, max: 1 },
          },
        ),
        explanation: f(
          "Explanation (optional)",
          "Rationale shown alongside the diagnosis at the terminal. HTML allowed.",
          { "ui:widget": "html" },
        ),
      },
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
  },
  ui: {
    "ui:title": "Button label overrides",
    restartButton: f("'Restart' button text"),
  },
} as const;

export default uiSchema;
