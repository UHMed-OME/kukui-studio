/**
 * RJSF uiSchema for the flashcards activity. Drives Studio's form
 * editor — field order, labels, help text, widget choices. Hand-tuned;
 * cannot be auto-derived from Zod alone because RJSF needs designer
 * decisions about layout and copy.
 *
 * Extracted from apps/studio-app/src/uiSchemas.ts. The COMMON / TITLE /
 * AUTHOR / HIDDEN / f() identifiers from that file are inlined here as
 * local constants so this module is standalone.
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

const TITLE = f(
  "Activity title",
  "Shown at the top of the activity and as the SCORM activity name.",
);

const AUTHOR = f(
  "Author (optional)",
  "Your name. Shown in the small credit line at the bottom of the activity.",
);

const uiSchema = {
  ...COMMON,
  "ui:order": ["title", "prompt", "cards", "behaviour", "ui", "*"],
  title: TITLE,
  author: AUTHOR,
  prompt: f("Intro / instructions", "Optional intro shown above the deck.", {
    "ui:widget": "html",
    "ui:options": { rows: 2 },
  }),
  cards: {
    "ui:title": "Cards",
    "ui:help": "Each card has a front and a back. HTML allowed in both.",
    items: {
      id: HIDDEN,
      front: f("Front (question side)", "What the learner sees first.", {
        "ui:widget": "html",
        "ui:options": { rows: 2 },
      }),
      back: f("Back (answer side)", "Revealed when the card flips.", {
        "ui:widget": "html",
        "ui:options": { rows: 2 },
      }),
      hint: f("Hint", "Optional hint shown alongside the front.", {
        "ui:widget": "textarea",
        "ui:options": { rows: 2 },
      }),
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    shuffle: f("Shuffle the deck", "Default on."),
  },
  ui: {
    "ui:title": "Button label overrides",
    gotItButton: f(
      "'Got it' button text",
      "Label shown after the learner flips a card and remembered the answer.",
    ),
    reviewAgainButton: f(
      "'Review again' button text",
      "Label shown after the learner flips a card and wants to revisit it.",
    ),
    nextButton: f("'Reveal answer' / next button text"),
  },
} as const;

export default uiSchema;
