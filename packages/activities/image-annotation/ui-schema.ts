/**
 * RJSF uiSchema for the image-annotation activity. Drives Studio's form
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

// After the Scoring tab landed, retry / single-point all live there. The
// constants below are kept as `HIDDEN` so the legacy schema fields don't
// render in the Editor form — they're owned by the Scoring tab now.
const BEHAVIOUR_RETRY = HIDDEN;
const BEHAVIOUR_SINGLEPOINT = HIDDEN;

const uiSchema = {
  ...COMMON,
  "ui:order": [
    "title",
    "prompt",
    "image",
    "tools",
    "expectedAnnotations",
    "behaviour",
    "ui",
    "*",
  ],
  // Title is authored on the visual editor's stage header, not the form.
  title: HIDDEN,
  author: AUTHOR,
  prompt: f("Prompt", "Tells the learner what to annotate.", {
    "ui:widget": "html",
    "ui:options": { rows: 3 },
  }),
  image: {
    "ui:title": "Image",
    src: f("Image", "Paste URL or upload.", {
      "ui:widget": "file",
      "ui:options": { accept: "image/*", maxSizeMb: 5, kind: "image" },
    }),
    alt: f(
      "Alt text (required)",
      "Required for accessibility. Describe what the image shows in one short sentence.",
    ),
  },
  tools: {
    "ui:title": "Annotation tools available to the learner",
    rectangle: f("Rectangle"),
    circle: f("Circle"),
    arrow: f("Arrow"),
    freehand: f("Freehand"),
  },
  expectedAnnotations: {
    "ui:title": "Expected (ground-truth) marks",
    "ui:help":
      "Drawn in edit mode by clicking the canvas. The activity compares learner annotations against these.",
    items: {
      id: HIDDEN,
      label: f("Label", "Optional. Shown on the mark for the author."),
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    singlePoint: BEHAVIOUR_SINGLEPOINT,
  },
  ui: {
    "ui:title": "Button label overrides",
    submitButtonLabel: f("'Submit' button text"),
    clearButton: f("'Clear' button text"),
  },
} as const;

export default uiSchema;
