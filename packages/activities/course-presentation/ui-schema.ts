/**
 * RJSF uiSchema for the course-presentation activity. Drives Studio's form
 * editor — field order, labels, help text, widget choices. Prose/HTML fields
 * use the shared Tiptap WYSIWYG widget (`ui:widget: "html"`) so authors format
 * with a toolbar instead of typing tags.
 *
 * COMMON / APPEARANCE / TITLE / AUTHOR / f() mirror the conventions in the
 * sibling activities' ui-schema modules. Kept standalone (no cross-import).
 *
 * The embedded `slides[].activity.config` is authored as a generic JSON object
 * for now (no nested RJSF form for the inner activity yet) — it is validated
 * at render against the matching multiple-choice / fill-in-the-blanks schema.
 */

const HIDDEN = { "ui:widget": "hidden" } as const;
const HTML = { "ui:widget": "html" } as const;

/** Leaf field: f(label, help, opts?). */
function f(title: string, help?: string, extra: Record<string, unknown> = {}) {
  return {
    "ui:title": title,
    ...(help ? { "ui:help": help } : {}),
    ...extra,
  };
}

/** Rich-text (WYSIWYG) leaf field. */
function fh(title: string, help?: string) {
  return f(title, help, HTML);
}

const APPEARANCE = {
  "ui:title": "Appearance",
  "ui:help":
    "Pin a color scheme for this activity. \"Auto\" follows the learner's OS preference.",
  theme: f(
    "Color scheme",
    "How the activity looks on the learner's screen. \"Auto\" lets the OS decide; pick a specific scheme to override the learner's preference.",
  ),
  header: f(
    "Header style",
    "Full = gradient banner with the kukui mark; Minimal = a plain title block.",
  ),
} as const;

const COMMON = {
  version: HIDDEN,
  _comment: HIDDEN,
  $schema: HIDDEN,
  appearance: APPEARANCE,
} as const;

const TITLE = f("Presentation title", "Shown in the banner and as the SCORM activity name.");
const AUTHOR = f("Author (optional)", "Your name. Shown in a small credit line.");

const uiSchema = {
  ...COMMON,
  "ui:order": ["title", "author", "slides", "*"],
  title: TITLE,
  author: AUTHOR,
  slides: {
    "ui:title": "Slides",
    "ui:help":
      "The deck, in order. Each slide can carry prose, an image, and an optional embedded activity.",
    items: {
      id: HIDDEN,
      title: f("Slide title (optional)", "Heading shown above the slide body."),
      body: fh("Slide content", "The prose for this slide."),
      media: {
        "ui:title": "Image (optional)",
        src: f("Image (upload or URL)", "Upload an image file or paste a hosted URL.", {
          "ui:widget": "file",
          "ui:options": {
            kind: "image",
            accept: "image/png,image/jpeg,image/gif,image/webp",
            maxSizeMb: 2,
          },
        }),
        alt: f("Alt text", "Required description of the image for screen readers."),
        caption: f("Caption (optional)"),
      },
      activity: {
        "ui:title": "Embedded activity (optional)",
        "ui:help":
          "An optional check-for-understanding for this slide. Choose the kind, then author its config as JSON for now.",
        kind: f("Activity kind", "multipleChoice or fillInTheBlanks."),
        config: f(
          "Activity config (JSON)",
          "The embedded activity's configuration, authored as JSON. Validated against the chosen activity's schema at render.",
        ),
      },
    },
  },
} as const;

export default uiSchema;
