/**
 * RJSF uiSchema for the matching-pairs activity. Drives Studio's form
 * editor — field order, labels, help text, widget choices. Hand-tuned;
 * cannot be auto-derived from Zod alone because RJSF needs designer
 * decisions about layout and copy.
 *
 * Extracted from apps/studio-app/src/uiSchemas.ts. The COMMON / TITLE /
 * AUTHOR / HIDDEN / BEHAVIOUR_* / f() identifiers from that file are
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

// After the Scoring tab landed, retry / single-point live there. The
// constants below are kept as `HIDDEN` so the legacy schema fields don't
// render in the Editor form — they're owned by the Scoring tab now.
const BEHAVIOUR_RETRY = HIDDEN;
const BEHAVIOUR_SINGLEPOINT = HIDDEN;

const uiSchema = {
  ...COMMON,
  "ui:order": ["title", "prompt", "pairs", "behaviour", "ui", "*"],
  title: TITLE,
  author: AUTHOR,
  prompt: f("Prompt", "Tells the learner what to match.", {
    "ui:widget": "html",
    "ui:options": { rows: 3 },
  }),
  pairs: {
    "ui:title": "Pairs (left ↔ right)",
    "ui:help":
      "Each row defines a correct match between a left-column item and a right-column item.",
    items: {
      id: HIDDEN,
      left: { "ui:title": "Left item", text: f("Text", "What the learner sees on the left side.") },
      right: {
        "ui:title": "Right item (correct partner)",
        text: f("Text", "What the learner sees on the right side."),
      },
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    singlePoint: BEHAVIOUR_SINGLEPOINT,
    randomizeRight: f(
      "Shuffle the right column",
      "Default on. The right side is shuffled so learners can't pair by position.",
    ),
  },
  ui: {
    "ui:title": "Button label overrides",
    checkAnswerButton: f("'Check' button text"),
    tryAgainButton: f("'Try Again' button text"),
  },
} as const;

export default uiSchema;
