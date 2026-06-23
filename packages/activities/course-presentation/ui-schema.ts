/**
 * RJSF uiSchema for the course-presentation activity. Drives Studio's form
 * editor — field order, labels, help text, widget choices.
 *
 * The deck itself (slides, their imported backgrounds, and the positioned
 * overlays) is authored on the visual canvas (the Edit tab), NOT in this form:
 * a raw RJSF array can't import a PDF, place an overlay rect, or seed a valid
 * checkpoint `config`, so exposing `slides` here would only produce broken,
 * unfixable items. `slides` is therefore HIDDEN and the canvas is the single,
 * working authoring path — the same split interactive-video uses for its
 * `interactions`.
 *
 * COMMON / APPEARANCE / TITLE / AUTHOR / f() mirror the conventions in the
 * sibling activities' ui-schema modules. Kept standalone (no cross-import).
 */

const HIDDEN = { "ui:widget": "hidden" } as const;

/** Leaf field: f(label, help, opts?). */
function f(title: string, help?: string, extra: Record<string, unknown> = {}) {
  return {
    "ui:title": title,
    ...(help ? { "ui:help": help } : {}),
    ...extra,
  };
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
  // Slides — including each slide's imported image background and its
  // positioned info/checkpoint overlays — are built on the Edit canvas.
  slides: HIDDEN,
} as const;

export default uiSchema;
