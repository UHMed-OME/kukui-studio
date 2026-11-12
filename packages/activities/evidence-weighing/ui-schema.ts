/**
 * RJSF uiSchema for the evidence-weighing activity. Drives Studio's form
 * editor — field order, labels, help text, widget choices. Hand-tuned;
 * cannot be auto-derived from Zod alone because RJSF needs designer
 * decisions about layout and copy.
 *
 * Extracted from apps/studio-app/src/uiSchemas.ts. The COMMON / APPEARANCE /
 * HIDDEN / f() identifiers from that file are inlined here as local
 * constants so this module is standalone.
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
    'Pin a color scheme for this activity. "Auto" follows the learner\'s OS preference.',
  theme: f(
    "Color scheme",
    'How the activity looks on the learner\'s screen. "Auto" lets the OS decide (light/dark); pick a specific scheme to override regardless of the learner\'s preference.',
  ),
} as const;

const COMMON = {
  version: HIDDEN,
  _comment: HIDDEN,
  $schema: HIDDEN,
  appearance: APPEARANCE,
} as const;

const TITLE = f("Activity title", "Shown at the top of the activity and as the SCORM activity name.");

const AUTHOR = f(
  "Author (optional)",
  "Your name. Shown in the small credit line at the bottom of the activity.",
);

// After the Scoring tab landed, retry / show-solution all
// live there. The constants below are kept as `HIDDEN` so the legacy
// schema fields don't render in the Editor form — they're owned by the
// Scoring tab now.
const BEHAVIOUR_RETRY = HIDDEN;
const BEHAVIOUR_SHOW_SOLUTION = HIDDEN;

const uiSchema = {
  ...COMMON,
  "ui:order": ["title", "ratings", "claims", "behaviour", "ui", "overallFeedback", "*"],
  title: TITLE,
  author: AUTHOR,
  ratings: {
    "ui:title": "Rating scale",
    "ui:help": "Define the ratings learners will assign to each piece of evidence.",
    items: {
      id: f(
        "Rating ID",
        "Unique identifier used internally.",
      ),
      label: f(
        "Rating label",
        "Rating text learners see and use.",
      ),
    },
  },
  claims: {
    "ui:title": "Claims",
    "ui:help": "Add claims and define evidence for each claim.",
    items: {
      claim: f(
        "Claim, hypothesis, or diagnosis",
        "The statement learners will use to evaluate evidence.",
        { "ui:widget": "html", "ui:options": { rows: 3 } },
      ),
      evidence: {
        "ui:title": "Evidence items",
        "ui:help": "Add evidence statements and specify their expected ratings.",
        items: {
          text: f(
            "Evidence text", 
            "Evidence statement shown to learners.",
            { "ui:widget": "textarea", "ui:options": { rows: 2 } },
          ),
          expectedRating: f(
            "Expected rating ID",
            "Enter the ID of one of the ratings defined above, such as 'weak' or 'strong'.",
            { "ui:widget": "select" },
          ),
          feedback: f(
            "Feedback after submit",
            "Optional feedback shown after the learner checks their answers.",
            { "ui:widget": "textarea", "ui:options": { rows: 2 } },
          ),
        },
      },
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    enableSolutionsButton: BEHAVIOUR_SHOW_SOLUTION,
  },
  ui: {
    "ui:title": "Button label overrides",
    checkAnswerButton: f("'Check' button text", "Defaults to 'Check'."),
    showSolutionButton: f("'Show Solution' button text", "Defaults to 'Show solution'."),
    tryAgainButton: f("'Try Again' button text", "Defaults to 'Try again'."),
  },
  overallFeedback: HIDDEN,
} as const;

export default uiSchema;
