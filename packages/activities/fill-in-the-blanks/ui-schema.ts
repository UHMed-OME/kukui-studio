/**
 * RJSF uiSchema for the fill-in-the-blanks activity. Drives Studio's form
 * editor — field order, labels, help text, widget choices. Hand-tuned;
 * cannot be auto-derived from Zod alone because RJSF needs designer
 * decisions about layout and copy.
 *
 * Extracted from apps/studio-app/src/uiSchemas.ts. The original COMMON
 * fragment (appearance pin, etc.) stays in the consumer; this object
 * is what Studio's aggregator merges with COMMON.
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
  "ui:order": ["title", "text", "behaviour", "ui", "*"],
  title: TITLE,
  author: AUTHOR,
  text: f(
    "Question text with blanks",
    "Wrap each blank in asterisks, like *answer*. Use | for alternate accepted answers, e.g. *Honolulu|Honoruru*. Slashes are literal, so answers like *mg/dL* work. Write \\* for a literal asterisk.",
    { "ui:widget": "textarea", "ui:options": { rows: 6 } },
  ),
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    caseSensitive: f(
      "Case-sensitive matching",
      "When on, 'Honolulu' is not the same as 'honolulu'.",
    ),
    acceptSpellingErrors: f(
      "Accept minor spelling errors",
      "Allows answers off by one letter (a single typo, missing letter, or extra letter).",
    ),
    showSolutionsButton: BEHAVIOUR_SHOW_SOLUTION,
    singlePoint: BEHAVIOUR_SINGLEPOINT,
  },
  ui: {
    "ui:title": "Button label overrides",
    checkAnswerButton: f("'Check' button text"),
    showSolutionButton: f("'Show Solution' button text"),
    tryAgainButton: f("'Try Again' button text"),
  },
} as const;

export default uiSchema;
