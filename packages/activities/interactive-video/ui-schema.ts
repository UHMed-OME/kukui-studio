/**
 * RJSF uiSchema for the interactive-video activity. Drives Studio's form
 * editor — field order, labels, help text, widget choices. Hand-tuned;
 * cannot be auto-derived from Zod alone because RJSF needs designer
 * decisions about layout and copy.
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
  "ui:order": ["title", "prompt", "video", "interactions", "behaviour", "ui", "*"],
  // Title is authored on the visual editor's stage header, not the form.
  title: HIDDEN,
  author: AUTHOR,
  prompt: f("Prompt", "Optional. Shown above the player.", {
    "ui:widget": "html",
    "ui:options": { rows: 2 },
  }),
  video: {
    "ui:title": "Video source",
    src: f("Video URL", "MP4, YouTube, or Vimeo URL."),
    type: f("Source type", "html5 for direct MP4; otherwise youtube / vimeo."),
    poster: f("Poster image", "Optional. Shown before play."),
  },
  // Interactions are authored on the visual timeline (the Edit tab), not in
  // this form: a raw RJSF array can't seed a valid sub-activity `config` (it's
  // a free-form record) or set timecodes, so adding one here produced a broken,
  // unfixable item. Hidden so the timeline is the single, working path.
  interactions: HIDDEN,
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    passPercentage: HIDDEN,
  },
  ui: {
    "ui:title": "Button label overrides",
    submitButtonLabel: f("'Submit' button text"),
  },
} as const;

export default uiSchema;
