/** RJSF uiSchema for the virtual-tour activity. Extracted from apps/studio-app/src/uiSchemas.ts. */

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

const uiSchema = {
  ...COMMON,
  "ui:order": ["title", "scene", "movement", "overlays", "completion", "behaviour", "ui", "*"],
  title: TITLE,
  author: AUTHOR,
  scene: {
    "ui:title": "Scene",
    src: f(
      "Scene file (.glb / .gltf)",
      "Paste a URL or upload a file. Glb files >5 MB don't persist between sessions but still ship with the SCORM zip.",
      {
        "ui:widget": "file",
        "ui:options": {
          accept: ".glb,.gltf,model/gltf-binary,model/gltf+json",
          maxSizeMb: 50,
          kind: "model",
        },
      },
    ),
    spawn: {
      "ui:title": "Where the learner starts",
      position: f("Spawn position (x, y, z)", "World-space coordinates."),
    },
  },
  movement: {
    "ui:title": "Movement controls",
    speed: f("Movement speed", "Higher = faster walk. Try 2 for a slow tour, 5 for a brisk one."),
  },
  overlays: {
    "ui:title": "Points of interest",
    "ui:help":
      "Clickable info panels. Each opens a modal with text, images, and audio.",
    items: {
      id: HIDDEN,
      title: f("Display title", "Shown above the overlay panel and on the marker pin."),
      position: f("World position (x, y, z)"),
      trigger: HIDDEN,
      content: {
        "ui:title": "Overlay content",
        "ui:help": "Heterogeneous list rendered top-to-bottom. Pick text, image, or audio per item.",
      },
    },
  },
  completion: {
    "ui:title": "Completion mode",
    mode: {
      ...f(
        "How the tour ends",
        "Manual: learner clicks Done. Visit-all: auto-complete when every required overlay has been opened.",
      ),
      "ui:enumNames": ["Visit all required points", "Manual ('Done' button)"],
    },
    requiredOverlayIds: f(
      "Required overlay IDs",
      "List of overlay IDs the learner must visit. Required when mode = visit-all.",
    ),
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    enableRetry: HIDDEN,
  },
  ui: {
    "ui:title": "Button label overrides",
    doneButton: f("'Done' button text"),
    closeOverlayButton: f("Close-overlay button label"),
  },
} as const;

export default uiSchema;
