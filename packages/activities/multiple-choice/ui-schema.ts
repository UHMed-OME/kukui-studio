/**
 * RJSF uiSchema for the multiple-choice activity. Drives Studio's form
 * editor — field order, labels, help text, widget choices. Hand-tuned;
 * cannot be auto-derived from Zod alone because RJSF needs designer
 * decisions about layout and copy.
 *
 * Extracted from apps/studio-app/src/uiSchemas.ts. The original COMMON
 * fragment (appearance pin, etc.) stays in the consumer; this object
 * is what Studio's aggregator (Task 14) will merge with COMMON.
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

const TITLE = f("Activity title", "Shown at the top of the activity and as the SCORM activity name.");

const AUTHOR = f(
  "Author (optional)",
  "Your name. Shown in the small credit line at the bottom of the activity.",
);

// After the Scoring tab landed, retry / show-solution / single-point all
// live there. The constants below are kept as `HIDDEN` so the legacy
// schema fields don't render in the Editor form — they're owned by the
// Scoring tab now.
const BEHAVIOUR_RETRY = HIDDEN;
const BEHAVIOUR_SHOW_SOLUTION = HIDDEN;
const BEHAVIOUR_SINGLEPOINT = HIDDEN;

const uiSchema = {
  "ui:order": ["title", "question", "answers", "behaviour", "ui", "overallFeedback", "*"],
  title: TITLE,
  author: AUTHOR,
  question: f(
    "Question prompt",
    "What the learner is asked. Use the toolbar to format text or paste HTML.",
    { "ui:widget": "html", "ui:options": { rows: 3 } },
  ),
  answers: {
    "ui:title": "Answer choices",
    "ui:help": "Two or more options. At least one must be marked correct.",
    items: {
      text: f("Choice text", "What the learner sees on this answer button. HTML allowed."),
      correct: f(
        "Counts as correct",
        "Selecting this option awards points toward the score.",
      ),
      feedback: f(
        "Feedback after submit",
        "Shown beneath the choice when the learner picks this answer.",
        { "ui:widget": "textarea", "ui:options": { rows: 2 } },
      ),
      tip: f(
        "Hover hint (before submit)",
        "Optional tooltip shown while the learner is still answering.",
        { "ui:widget": "textarea", "ui:options": { rows: 2 } },
      ),
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    enableSolutionsButton: BEHAVIOUR_SHOW_SOLUTION,
    singlePoint: BEHAVIOUR_SINGLEPOINT,
    randomAnswers: f(
      "Randomize answer order",
      "Shuffle the answer rows each time the activity loads.",
    ),
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
