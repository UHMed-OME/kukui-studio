/**
 * RJSF uiSchema for the lab-panel activity. Drives Studio's form editor —
 * field order, labels, help text, widget choices. Hand-tuned; cannot be
 * auto-derived from Zod alone because RJSF needs designer decisions about
 * layout and copy.
 *
 * Extracted from apps/studio-app/src/uiSchemas.ts. The COMMON / TITLE /
 * AUTHOR / HIDDEN / BEHAVIOUR_RETRY / BEHAVIOUR_SINGLEPOINT / f()
 * identifiers from that file are inlined here as local constants so this
 * module is standalone.
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

// Single-point (all-or-nothing) scoring is exposed via the Scoring tab.
const BEHAVIOUR_SINGLEPOINT = HIDDEN;

const uiSchema = {
  ...COMMON,
  "ui:order": ["title", "prompt", "panel", "interpretation", "behaviour", "ui", "overallFeedback", "*"],
  title: TITLE,
  author: AUTHOR,
  prompt: f("Clinical context", "Brief vignette shown above the lab panel.", {
    "ui:widget": "html",
    "ui:options": { rows: 4 },
  }),
  panel: {
    "ui:title": "Lab panel",
    name: f("Panel name", "e.g. 'Basic Metabolic Panel'."),
    values: {
      "ui:title": "Panel values",
      items: {
        id: HIDDEN,
        analyte: f("Analyte", "e.g. 'Sodium', 'WBC'."),
        result: f("Result", "Numeric or qualitative value."),
        units: f("Units"),
        reference: f("Reference range"),
        flag: f("Flag", "high, low, or normal. Colour-codes the row."),
        isAbnormal: f(
          "Abnormal (answer key)",
          "Mark on if the learner should flag this row as abnormal. This is the answer key the row selections are scored against.",
        ),
      },
    },
  },
  interpretation: {
    "ui:title": "Interpretation question",
    question: f("Question", "What the learner is asked after reading the panel."),
    choices: {
      "ui:title": "Answer choices",
      items: {
        id: HIDDEN,
        text: f("Answer text"),
        correct: f("Correct"),
        feedback: f("Feedback", "Optional. Shown when this choice is picked."),
      },
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    singlePoint: BEHAVIOUR_SINGLEPOINT,
  },
  ui: {
    "ui:title": "Button label overrides",
    checkAnswerButton: f("'Check' button text"),
    tryAgainButton: f("'Try Again' button text"),
  },
  overallFeedback: HIDDEN,
} as const;

export default uiSchema;
