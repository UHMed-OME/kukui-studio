/** RJSF uiSchema for the hotspot-3d activity. Extracted from apps/studio-app/src/uiSchemas.ts. */

const HIDDEN = { "ui:widget": "hidden" } as const;

/** APPEARANCE/COMMON copy — inlined so this module is standalone. */
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

/** Compact builder: f(label, help, opts?) → uiSchema fragment for a leaf field. */
function f(title: string, help?: string, extra: Record<string, unknown> = {}) {
  return {
    "ui:title": title,
    ...(help ? { "ui:help": help } : {}),
    ...extra,
  };
}

const TITLE = f("Activity title", "Shown at the top of the activity and as the SCORM activity name.");

const AUTHOR = f(
  "Author (optional)",
  "Your name. Shown in the small credit line at the bottom of the activity.",
);

// Scoring tab owns retry / show-solution now; keep this here as HIDDEN
// so the legacy schema field doesn't render in the Editor form.
const BEHAVIOUR_RETRY = HIDDEN;

const uiSchema = {
  ...COMMON,
  "ui:order": ["title", "prompt", "model", "camera", "hotspots", "behaviour", "ui", "*"],
  title: TITLE,
  author: AUTHOR,
  prompt: f(
    "Prompt shown to the learner",
    "Tells the learner what part to identify. Use the toolbar to format text.",
    { "ui:widget": "html", "ui:options": { rows: 3 } },
  ),
  model: {
    "ui:title": "3D model",
    "ui:field": "modelSource",
    scale: f("Uniform scale", "Multiplies model size by this factor. Default 1."),
  },
  camera: {
    "ui:title": "Camera setup",
    mode: HIDDEN,
    initialDistance: f("Starting distance", "How far the camera sits from the model on load."),
    minDistance: f("Closest zoom", "How close the orbit camera can get."),
    maxDistance: f("Farthest zoom", "How far the orbit camera can pull back."),
    target: f("Look-at point", "World-space XYZ the camera focuses on."),
  },
  hotspots: {
    "ui:title": "Clickable hotspots",
    "ui:help":
      "Each hotspot is a sphere placed in the model's local space. Exactly one should be marked correct.",
    items: {
      id: HIDDEN,
      label: f(
        "Label",
        "Shown in the keyboard fallback list and as a 3D marker pin when markers are visible.",
      ),
      position: f("Position (x, y, z)", "Where the hotspot sits in the model's local space."),
      radius: f("Click radius", "How close the click has to be to count as a hit."),
      correct: f("Counts as correct", "Selecting this hotspot is the answer the learner is looking for."),
      feedback: f(
        "Feedback after pick",
        "Shown after the learner submits if they picked this hotspot.",
        { "ui:widget": "textarea", "ui:options": { rows: 2 } },
      ),
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: BEHAVIOUR_RETRY,
    showHotspotMarkers: f(
      "Show hotspot markers",
      "When on, learners see labeled spheres indicating each hotspot. When off, blind identification.",
    ),
    allowOrbit: f("Allow orbit camera", "Lets learners rotate the camera around the model."),
    aspectRatio: {
      ...f(
        "Viewport aspect ratio",
        "Shape of the 3D canvas. Pick what matches your reference art — widescreen for landscape models, square for figurines, 4/3 for portrait setups.",
      ),
      "ui:enumNames": ["16 : 10 (default)", "16 : 9 (widescreen)", "4 : 3", "1 : 1 (square)"],
    },
  },
  ui: {
    "ui:title": "Button label overrides",
    tryAgainButton: f("'Try Again' button text"),
    resetViewButton: f("'Reset view' button text"),
  },
} as const;

export default uiSchema;
