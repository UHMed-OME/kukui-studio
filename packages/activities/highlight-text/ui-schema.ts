/**
 * RJSF uiSchema for the highlight-text activity. Drives Studio's form
 * editor — field order, labels, help text, widget choices. Hand-tuned;
 * cannot be auto-derived from Zod alone because RJSF needs designer
 * decisions about layout and copy.
 *
 * Extracted from apps/studio-app/src/uiSchemas.ts. The COMMON / TITLE /
 * AUTHOR / HIDDEN / f() / BEHAVIOUR_RETRY / BEHAVIOUR_SINGLEPOINT
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

// Retry / single-point live in the Scoring tab now; the legacy schema
// fields are hidden in the Editor form (BEHAVIOUR_RETRY /
// BEHAVIOUR_SINGLEPOINT in apps/studio-app/src/uiSchemas.ts).
const BEHAVIOUR_RETRY = HIDDEN;
const BEHAVIOUR_SINGLEPOINT = HIDDEN;

const uiSchema = {
  ...COMMON,
  "ui:order": ["title", "prompt", "tokens", "behaviour", "ui", "overallFeedback", "*"],
  title: TITLE,
  author: AUTHOR,
  prompt: f("Prompt", "Tells the learner what to highlight.", {
    "ui:widget": "html",
    "ui:options": { rows: 3 },
  }),
  tokens: {
    "ui:title": "Tokens (each is clickable)",
    "ui:help":
      "Render order matters — tokens render with single spaces between unless a separator is set.",
    items: {
      id: HIDDEN,
      text: f("Token text", "The word or phrase the learner sees."),
      correct: f("Counts as correct", "Selecting this token contributes to the score."),
      separator: f(
        "Separator after token",
        "Optional. Defaults to a single space. Set to an empty string for no space, or to ', ' / '. ' / etc.",
      ),
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
