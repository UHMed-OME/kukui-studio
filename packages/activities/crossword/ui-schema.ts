/**
 * RJSF uiSchema for the crossword activity. Drives Studio's form editor —
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
  "ui:order": ["title", "prompt", "entries", "behaviour", "ui", "*"],
  title: TITLE,
  author: AUTHOR,
  prompt: f(
    "Prompt",
    "Optional. Shown above the puzzle. Frame the topic or give solving instructions.",
    { "ui:widget": "html", "ui:options": { rows: 2 } },
  ),
  entries: {
    "ui:title": "Terms & definitions",
    "ui:help":
      "Each entry is one word in the crossword paired with the clue learners see. Terms must be 2-32 A-Z letters (no spaces or punctuation). Add at least 2 entries; aim for 6-12 for a satisfying puzzle.",
    // Hide the editor's row index — its "1, 2, 3…" reads like a clue number,
    // but the puzzle numbers clues by grid position, not entry order. The
    // term itself (shown as the card label) is the unambiguous identifier.
    "ui:options": { hideItemIndex: true },
    items: {
      id: HIDDEN,
      term: f(
        "Term (answer)",
        "The word learners must fill in. Letters only (A-Z). Case is ignored; it always renders in upper case.",
      ),
      definition: f("Definition (clue)", "The clue shown in the Across/Down list."),
      hint: f(
        "Hint (optional)",
        "Surfaces when the learner selects this clue, if hints are enabled.",
      ),
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    allowReshuffle: f(
      "Allow 'New layout'",
      "Let the learner regenerate the grid for a fresh arrangement of the same terms.",
    ),
    allowReveal: f(
      "Allow 'Reveal letter / word'",
      "Reveal buttons fill in the answer; revealed cells don't count toward the grade.",
    ),
    showHints: f(
      "Show hint affordance",
      "Renders a hint banner for the active clue when its entry has a hint.",
    ),
  },
  ui: {
    "ui:title": "Button label overrides",
    checkButton: f("'Check' button text"),
    revealLetterButton: f("'Reveal letter' button text"),
    revealWordButton: f("'Reveal word' button text"),
    reshuffleButton: f("'New layout' button text"),
    submitButton: f("'Submit' button text"),
  },
} as const;

export default uiSchema;
