/**
 * RJSF uiSchema for the audio-recording activity. Drives Studio's form editor —
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

const uiSchema = {
  ...COMMON,
  "ui:order": [
    "title",
    "prompt",
    "referenceAudio",
    "minDurationSeconds",
    "maxDurationSeconds",
    "behaviour",
    "ui",
    "*",
  ],
  title: TITLE,
  author: AUTHOR,
  prompt: f("Prompt", "What the learner records.", {
    "ui:widget": "html",
    "ui:options": { rows: 3 },
  }),
  referenceAudio: {
    "ui:title": "Reference audio (optional)",
    src: f(
      "Audio URL",
      "Optional model pronunciation the learner can play before recording.",
    ),
    caption: f("Caption", "Optional. Shown under the reference audio player."),
  },
  minDurationSeconds: f(
    "Minimum seconds",
    "Optional. Submit stays disabled until the recording is at least this long.",
  ),
  maxDurationSeconds: f(
    "Maximum seconds",
    "Optional. Recording auto-stops at this length. Note: SCORM 1.2 can only persist short clips (~5 seconds) across resume — longer recordings still submit and grade as completed, but won't replay if the learner returns to the activity.",
  ),
  behaviour: {
    "ui:title": "Activity behaviour",
    allowReRecord: f(
      "Allow re-record",
      "Let the learner discard a take and record again before submitting.",
    ),
  },
  ui: {
    "ui:title": "Button label overrides",
    recordButton: f("'Record' button text"),
    stopButton: f("'Stop' button text"),
    playbackButton: f("Playback label", "Accessible label on the playback player."),
    reRecordButton: f("'Re-record' button text"),
    submitButton: f("'Submit' button text"),
  },
} as const;

export default uiSchema;
