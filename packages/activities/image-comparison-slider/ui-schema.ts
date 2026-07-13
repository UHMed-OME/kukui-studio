/**
 * RJSF uiSchema for the image-comparison-slider activity. Drives Studio's
 * form editor — field order, labels, help text, widget choices. Hand-tuned;
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
    "before",
    "after",
    "initialPosition",
    "behaviour",
    "ui",
    "attribution",
    "*",
  ],
  title: TITLE,
  author: AUTHOR,
  prompt: f("Prompt", "Tells the learner what to look at.", {
    "ui:widget": "html",
    "ui:options": { rows: 3 },
  }),
  before: {
    "ui:title": "Before image",
    src: f("Image", "Paste URL or upload.", {
      "ui:widget": "file",
      "ui:options": { accept: "image/*", maxSizeMb: 5, kind: "image" },
    }),
    alt: f(
      "Alt text (required)",
      "Required for accessibility. Describe the 'before' state in one short sentence.",
    ),
    caption: f("Caption", "Optional. Shown beneath the image."),
  },
  after: {
    "ui:title": "After image",
    src: f("Image", "Paste URL or upload.", {
      "ui:widget": "file",
      "ui:options": { accept: "image/*", maxSizeMb: 5, kind: "image" },
    }),
    alt: f(
      "Alt text (required)",
      "Required for accessibility. Describe the 'after' state in one short sentence.",
    ),
    caption: f("Caption", "Optional."),
  },
  initialPosition: f(
    "Initial seam position (0..1)",
    "Where the seam starts. 0 = after fills the canvas; 1 = before fills the canvas. Default 0.5 shows half of each.",
  ),
  behaviour: {
    "ui:title": "Activity behaviour",
    autoSnap: f("Auto-snap to centre on release", "Seam returns to 0.5 when the learner lets go."),
  },
  ui: {
    "ui:title": "Button label overrides",
    doneButton: f("'Done' button text"),
    tryAgainButton: f("'Try again' button text"),
  },
  attribution: {
    "ui:title": "Image credit (optional)",
    "ui:help":
      "Credit the photographer or source. One credit covers both images. Shows as a small credit line under the activity. CC0 / public-domain images need no credit, but a courtesy credit is good practice.",
    author: f("Author", "Name of the photographer or source, shown in the credit line."),
    authorUrl: f("Author URL", "Optional link to the author's page."),
    sourceUrl: f("Source URL", "Optional link to the original image page (for example, the Wikimedia Commons file)."),
    license: f("License", "Short license name, for example \"CC0\" or \"CC BY 4.0\"."),
    licenseUrl: f("License URL", "Optional link to the canonical license text."),
  },
} as const;

export default uiSchema;
