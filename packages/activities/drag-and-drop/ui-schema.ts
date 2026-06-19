/**
 * RJSF uiSchema for the drag-and-drop activity. Drives Studio's form
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

const AUTHOR = f(
  "Author (optional)",
  "Your name. Shown in the small credit line at the bottom of the activity.",
);

// After the Scoring tab landed, retry / show-solution / single-point all
// live there. The constants below are kept as `HIDDEN` so the legacy
// schema fields don't render in the Editor form — they're owned by the
// Scoring tab now.
const BEHAVIOUR_RETRY = HIDDEN;
const BEHAVIOUR_SHOW_SOLUTION = HIDDEN;
const BEHAVIOUR_SINGLEPOINT = HIDDEN;

const uiSchema = {
  ...COMMON,
  "ui:order": ["title", "prompt", "background", "draggables", "dropZones", "behaviour", "ui", "*"],
  // Title is authored on the visual editor's stage header, not the form.
  title: HIDDEN,
  author: AUTHOR,
  prompt: f(
    "Instructions",
    "One-line direction shown below the title — what the learner should do. Leave blank to use the built-in default (\"Drag each label to its matching drop zone, then tap Check…\").",
    { "ui:widget": "html", "ui:options": { rows: 2 } },
  ),
  background: {
    "ui:title": "Background image (optional)",
    "ui:help":
      "The image learners drop labels onto. Drop-zone rectangles are placed on top of it. Leave blank to use a plain stage with a faint grid — useful for text-table / labelled-bin puzzles where the drop zones do the visual work themselves.",
    src: f(
      "Image",
      "Paste a link or upload a file. Uploaded files are saved inside the activity. Leave blank for an image-less stage.",
      {
        "ui:widget": "file",
        "ui:options": { accept: "image/*", maxSizeMb: 5, kind: "image" },
      },
    ),
    alt: f(
      "Alt text (required if image set)",
      "Describes the image for screen-reader users. Required for accessibility whenever you've supplied an image — describe what it shows in one short sentence.",
    ),
  },
  draggables: {
    "ui:title": "Labels",
    "ui:help": "The labels the learner picks up and drags into zones. Each one declares which zone(s) count as correct for it.",
    items: {
      // Surface the auto-generated id read-only so authors can map a
      // label row to its data id in the preview / fixtures. Editing
      // it manually risks orphaning references — lock it down.
      id: f(
        "ID (read-only)",
        "Auto-generated — used to identify this label internally.",
        { "ui:readonly": true },
      ),
      label: f("Text", "What the learner sees on the label."),
      correctZones: f(
        "Correct zone IDs",
        "List of dropZone IDs where placing this label counts as correct.",
      ),
      feedback: f(
        "Feedback after submit",
        "Shown after the learner checks their work.",
        { "ui:widget": "textarea", "ui:options": { rows: 2 } },
      ),
    },
  },
  dropZones: {
    "ui:title": "Drop zones",
    "ui:help": "Rectangles overlaid on the background image where labels can be dropped.",
    items: {
      // Show the auto-generated id read-only so the author can match
      // each row in this list to the corresponding `correctZones`
      // entry on the label above. Editing it manually risks orphaning
      // references; lock it down.
      id: f(
        "ID (read-only)",
        "Auto-generated — referenced by labels in their `correctZones` list.",
        { "ui:readonly": true },
      ),
      label: f("Zone label", "Optional — shown when the zone has its label visible."),
      rect: {
        "ui:title": "Rectangle (normalized 0..1)",
        "ui:help": "Position and size as fractions of the background image. (0,0) is top-left.",
        x: f("X (left)", "0 = left edge, 1 = right edge."),
        y: f("Y (top)", "0 = top edge, 1 = bottom edge."),
        w: f("Width", "0..1 fraction of the background's width."),
        h: f("Height", "0..1 fraction of the background's height."),
      },
      capacity: f(
        "Max labels this zone can hold",
        "Default 1. Set higher to allow multiple labels in the same zone.",
      ),
      showLabel: f("Show the zone's label", "Render the zone's text label inside the rectangle."),
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    enableSolutionsButton: BEHAVIOUR_SHOW_SOLUTION,
    singlePoint: BEHAVIOUR_SINGLEPOINT,
    interaction: {
      ...f(
        "Interaction mode",
        "How learners place labels. Auto picks drag for mouse/pen and tap-to-place for touch / keyboard. Drag forces the drag flow; tap forces tap-to-place (also used on phones regardless of this setting).",
      ),
      "ui:enumNames": ["Auto-detect", "Drag", "Tap-to-place"],
    },
    aspectRatio: {
      ...f(
        "Board aspect ratio",
        "Shape of the board. 16:10 (default) is widest; pick 4:3 or 1:1 if your background image is taller.",
      ),
      "ui:enumNames": ["16:10 (widescreen)", "4:3", "1:1 (square)"],
    },
  },
  ui: {
    "ui:title": "Button label overrides",
    checkAnswerButton: f("'Check' button text"),
    showSolutionButton: f("'Show Solution' button text"),
    tryAgainButton: f("'Try Again' button text"),
  },
} as const;

export default uiSchema;
