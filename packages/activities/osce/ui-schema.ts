/**
 * RJSF uiSchema for the osce activity. Drives Studio's form editor —
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
  "ui:order": ["title", "phases", "expectedOrder", "behaviour", "ui", "*"],
  title: TITLE,
  author: AUTHOR,
  phases: {
    "ui:title": "Encounter phases",
    "ui:help":
      "Each phase has a name and a list of actions the learner can take. Author marks which actions are correct.",
    items: {
      id: HIDDEN,
      name: f("Phase name", "e.g. 'History', 'Examination', 'Closure'."),
      description: f("Description", "Optional. Shown when the phase opens."),
    },
  },
  expectedOrder: f(
    "Expected phase order",
    "Optional. Phase ids in the order the learner should perform them.",
  ),
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    allowSkipPhase: f(
      "Allow free phase navigation",
      "Lets the learner jump between phases via the stepper. Off = linear (next/back) only.",
    ),
    guessPenalty: f(
      "Wrong-answer penalty (0..1)",
      "How much each wrong selection subtracts from a phase's earned points. Default 1; set to 0 to remove the penalty entirely.",
      { "ui:options": { step: 0.1, min: 0, max: 1 } },
    ),
  },
  ui: {
    "ui:title": "Button label overrides",
    submitButtonLabel: f("'Submit' button text"),
  },
} as const;

export default uiSchema;
