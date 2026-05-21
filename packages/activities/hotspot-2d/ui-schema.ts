/**
 * RJSF uiSchema for the hotspot-2d activity. Drives Studio's form editor —
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

const TITLE = f("Activity title", "Shown at the top of the activity and as the SCORM activity name.");

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
  "ui:order": ["title", "prompt", "image", "hotspots", "behaviour", "ui", "*"],
  title: TITLE,
  author: AUTHOR,
  prompt: f(
    "Prompt shown to the learner",
    "Tells the learner what region to find. Use the toolbar to format text.",
    { "ui:widget": "html", "ui:options": { rows: 3 } },
  ),
  image: {
    "ui:title": "Image",
    src: f("Image", "Paste a link or upload a file. Uploaded files are saved inside the activity.", {
      "ui:widget": "file",
      "ui:options": { accept: "image/*", maxSizeMb: 5, kind: "image" },
    }),
    alt: f(
      "Alt text (required)",
      "Describes the image for screen-reader users. Required for accessibility — describe what the image shows in one short sentence.",
    ),
  },
  hotspots: {
    "ui:title": "Hotspots",
    "ui:help":
      "Rectangles overlaid on the image. Exactly one should be marked correct. Edit positions visually in the Edit-mode tab once that lands.",
    items: {
      id: HIDDEN,
      label: f("Label", "Shown on the marker pin and in the keyboard fallback list."),
      rect: {
        "ui:title": "Rectangle (normalized 0..1)",
        x: f("X (left)"),
        y: f("Y (top)"),
        w: f("Width"),
        h: f("Height"),
      },
      correct: f("Counts as correct", "Selecting this region is the right answer."),
      feedback: f("Feedback after pick", "Shown after the learner submits if they picked this region.", {
        "ui:widget": "textarea",
        "ui:options": { rows: 2 },
      }),
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    showHotspotMarkers: f(
      "Show hotspot markers",
      "When on, learners see labeled rectangles indicating each region. When off, blind identification.",
    ),
  },
  ui: {
    "ui:title": "Button label overrides",
    tryAgainButton: f("'Try Again' button text"),
  },
} as const;

export default uiSchema;
