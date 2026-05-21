/**
 * RJSF uiSchema for the question-set activity. Drives Studio's form editor —
 * field order, labels, help text, widget choices. Hand-tuned; cannot be
 * auto-derived from Zod alone because RJSF needs designer decisions about
 * layout and copy.
 *
 * Extracted from apps/studio-app/src/uiSchemas.ts. The COMMON / TITLE /
 * AUTHOR / HIDDEN / BEHAVIOUR_RETRY / f() identifiers from that file are
 * inlined here as local constants so this module is standalone.
 *
 * Note: question-set is in STUDIO_SUPPRESSED — Studio does not surface it in
 * the catalog — but this uiSchema is still wired through the manifest for
 * consistency with the rest of the activity-co-location pattern.
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

const TITLE = f("Activity title", "Shown at the top of the activity and as the SCORM activity name.");

const AUTHOR = f(
  "Author (optional)",
  "Your name. Shown in the small credit line at the bottom of the activity.",
);

// After the Scoring tab landed, retry / show-solution / single-point all
// live there. BEHAVIOUR_RETRY is HIDDEN so the legacy schema field doesn't
// render in the Editor form — owned by the Scoring tab now.
const BEHAVIOUR_RETRY = HIDDEN;

const uiSchema = {
  ...COMMON,
  "ui:order": ["title", "questions", "passPercentage", "behaviour", "ui", "*"],
  title: TITLE,
  author: AUTHOR,
  questions: {
    "ui:title": "Questions in this set",
    "ui:help":
      "An ordered series of questions. Each entry's `type` selects the activity shape (multiple choice or fill-in-the-blanks).",
    items: {
      type: {
        ...f("Question type", "Picks the activity shape used for the question."),
        "ui:enumNames": ["Multiple choice", "Fill in the blanks"],
      },
      config: f("Activity config", "The full config for the picked question type."),
      weight: f(
        "Weight",
        "Optional. Defaults to 1. Higher weight = this question contributes more to the final score.",
      ),
    },
  },
  passPercentage: HIDDEN,
  behaviour: {
    "ui:title": "Activity behaviour",
    randomQuestions: f("Randomize question order", "Shuffle question order each time the set loads."),
    showResults: f("Show per-question results", "Reveal correctness per question after Submit Set."),
    enableRetry: BEHAVIOUR_RETRY,
    showProgressBar: f("Show progress bar", "Display a 'Question N of M' indicator."),
  },
  ui: {
    "ui:title": "Button label overrides",
    nextQuestionButton: f("'Next' button text"),
    previousQuestionButton: f("'Previous' button text"),
    submitSetButton: f("'Submit set' button text"),
    tryAgainButton: f("'Try Again' button text"),
  },
} as const;

export default uiSchema;
