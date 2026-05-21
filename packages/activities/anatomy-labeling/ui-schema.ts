/**
 * RJSF uiSchema for the anatomy-labeling activity. Drives Studio's form
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

// Retry / single-point now live in the Scoring tab; the legacy schema
// fields are hidden in the Editor form.
const BEHAVIOUR_RETRY = HIDDEN;
const BEHAVIOUR_SINGLEPOINT = HIDDEN;

const uiSchema = {
  ...COMMON,
  "ui:order": ["title", "prompt", "image", "labels", "targets", "behaviour", "ui", "*"],
  title: TITLE,
  author: AUTHOR,
  prompt: f("Prompt", "Tells the learner what to label.", {
    "ui:widget": "html",
    "ui:options": { rows: 3 },
  }),
  image: {
    "ui:title": "Image",
    src: f("Image", "Paste a link or upload a file. Uploaded files are saved inside the activity.", {
      "ui:widget": "file",
      "ui:options": { accept: "image/*", maxSizeMb: 5, kind: "image" },
    }),
    alt: f(
      "Alt text (required)",
      "Description for screen-reader users. Required for accessibility — describe what the diagram shows in one short sentence.",
    ),
  },
  labels: {
    "ui:title": "Labels",
    "ui:help": "Each label declares which target id is its correct home.",
    items: {
      id: HIDDEN,
      text: f("Label text"),
      correctTargetId: f("Correct target id", "Must match one of the target ids declared below."),
    },
  },
  targets: {
    "ui:title": "Targets (numbered points)",
    "ui:help": "Each target is a small numbered circle on the image.",
    items: {
      id: HIDDEN,
      position: { "ui:title": "Position (0..1)", x: f("X (left)"), y: f("Y (top)") },
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    singlePoint: BEHAVIOUR_SINGLEPOINT,
    randomizeLabels: f("Shuffle labels", "Tray order randomized on load."),
  },
  ui: {
    "ui:title": "Button label overrides",
    checkAnswerButton: f("'Check' button text"),
    tryAgainButton: f("'Try Again' button text"),
  },
} as const;

export default uiSchema;
