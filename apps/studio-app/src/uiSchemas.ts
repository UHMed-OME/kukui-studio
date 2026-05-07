/**
 * RJSF uiSchemas, one per activity kind.
 *
 * Every meaningful field gets a human-readable `ui:title` + a one-line
 * `ui:help` explanation. Help text becomes a hover-tooltip via the custom
 * FieldTemplate in templates/FieldTemplate.tsx; description text (where
 * present) renders inline below the label for fields that need format
 * guidance the author has to see at a glance.
 */
import { type ActivityKind, PLANNED_ACTIVITY_KINDS } from "@kukui/core";

const HIDDEN = { "ui:widget": "hidden" } as const;

const COMMON = {
  version: HIDDEN,
  _comment: HIDDEN,
  $schema: HIDDEN,
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

const BEHAVIOUR_RETRY = f("Allow retry", "Show a Try Again button after the learner submits.");
const BEHAVIOUR_SHOW_SOLUTION = f(
  "Allow Show Solution",
  "Lets the learner reveal the correct answers after submitting.",
);
const BEHAVIOUR_SINGLEPOINT = f(
  "All-or-nothing scoring",
  "When on, the activity is graded 1/1 only when fully correct. Otherwise partial credit.",
);

export const UI_SCHEMAS: Record<ActivityKind, Record<string, unknown>> = {
  "multiple-choice": {
    ...COMMON,
    "ui:order": ["title", "question", "answers", "behaviour", "ui", "overallFeedback", "*"],
    title: TITLE,
    question: f(
      "Question prompt",
      "What the learner is asked. Use the toolbar to format text or paste HTML.",
      { "ui:widget": "html", "ui:options": { rows: 3 } },
    ),
    answers: {
      "ui:title": "Answer choices",
      "ui:help": "Two or more options. At least one must be marked correct.",
      items: {
        text: f("Choice text", "What the learner sees on this answer button. HTML allowed."),
        correct: f(
          "Counts as correct",
          "Selecting this option awards points toward the score.",
        ),
        feedback: f(
          "Feedback after submit",
          "Shown beneath the choice when the learner picks this answer.",
          { "ui:widget": "textarea", "ui:options": { rows: 2 } },
        ),
        tip: f(
          "Hover hint (before submit)",
          "Optional tooltip shown while the learner is still answering.",
          { "ui:widget": "textarea", "ui:options": { rows: 2 } },
        ),
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
      enableSolutionsButton: BEHAVIOUR_SHOW_SOLUTION,
      singlePoint: BEHAVIOUR_SINGLEPOINT,
      randomAnswers: f(
        "Randomize answer order",
        "Shuffle the answer rows each time the activity loads.",
      ),
    },
    ui: {
      "ui:title": "Button label overrides",
      checkAnswerButton: f("'Check' button text", "Defaults to 'Check'."),
      showSolutionButton: f("'Show Solution' button text", "Defaults to 'Show solution'."),
      tryAgainButton: f("'Try Again' button text", "Defaults to 'Try again'."),
    },
    overallFeedback: {
      "ui:title": "Overall feedback bands",
      "ui:help": "Per-score-range message. The band whose [from..to] contains the final score is shown.",
      items: {
        from: f("From (%)", "Lower bound of this band, inclusive."),
        to: f("To (%)", "Upper bound of this band, inclusive."),
        message: f("Message", "What the learner sees if their final score falls in this band."),
      },
    },
  },

  "fill-in-the-blanks": {
    ...COMMON,
    "ui:order": ["title", "text", "behaviour", "ui", "*"],
    title: TITLE,
    text: f(
      "Cloze text",
      "Wrap each blank in asterisks: *answer*. Use / or | for alternates: *Honolulu/O'ahu*.",
      { "ui:widget": "textarea", "ui:options": { rows: 6 } },
    ),
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
      caseSensitive: f(
        "Case-sensitive matching",
        "When on, 'Honolulu' is not the same as 'honolulu'.",
      ),
      acceptSpellingErrors: f(
        "Accept minor spelling errors",
        "Allows answers within Levenshtein distance 1 (one missing/wrong/extra letter).",
      ),
      showSolutionsButton: BEHAVIOUR_SHOW_SOLUTION,
      singlePoint: BEHAVIOUR_SINGLEPOINT,
    },
    ui: {
      "ui:title": "Button label overrides",
      checkAnswerButton: f("'Check' button text"),
      showSolutionButton: f("'Show Solution' button text"),
      tryAgainButton: f("'Try Again' button text"),
    },
  },

  "drag-and-drop": {
    ...COMMON,
    "ui:order": ["title", "background", "draggables", "dropZones", "behaviour", "ui", "*"],
    title: TITLE,
    background: {
      "ui:title": "Background image",
      "ui:help": "The image learners drop labels onto. Drop-zone rectangles are placed on top of it.",
      src: f("Image", "Paste a URL or upload a file. Files embed inline in the JSON.", {
        "ui:widget": "file",
        "ui:options": { accept: "image/*", maxSizeMb: 5, kind: "image" },
      }),
      alt: f(
        "Alt text",
        "Describes the image for screen-reader users. Empty if the image is purely decorative.",
      ),
    },
    draggables: {
      "ui:title": "Draggable labels",
      "ui:help": "The chips the learner picks up. Each one declares which zone(s) count as correct for it.",
      items: {
        id: f("Internal ID", "Unique identifier — referenced by drop zones below. Lowercase, no spaces."),
        label: f("Label text", "What the learner sees on the chip."),
        correctZones: f(
          "Correct zone IDs",
          "List of dropZone IDs where placing this chip counts as correct.",
        ),
        feedback: f(
          "Feedback after submit",
          "Per-draggable feedback shown after the learner checks their work.",
          { "ui:widget": "textarea", "ui:options": { rows: 2 } },
        ),
      },
    },
    dropZones: {
      "ui:title": "Drop zones",
      "ui:help": "Rectangles overlaid on the background image where chips can be placed.",
      items: {
        id: f("Internal ID", "Unique identifier — referenced by draggables above."),
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
          "Max chips this zone can hold",
          "Default 1. Set higher to allow multiple chips in the same zone.",
        ),
        showLabel: f("Show the zone's label", "Render the zone's text label inside the rectangle."),
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
      enableSolutionsButton: BEHAVIOUR_SHOW_SOLUTION,
      singlePoint: BEHAVIOUR_SINGLEPOINT,
    },
    ui: {
      "ui:title": "Button label overrides",
      checkAnswerButton: f("'Check' button text"),
      showSolutionButton: f("'Show Solution' button text"),
      tryAgainButton: f("'Try Again' button text"),
    },
  },

  "course-presentation": {
    ...COMMON,
    "ui:order": ["title", "slides", "passPercentage", "behaviour", "ui", "*"],
    title: TITLE,
    slides: {
      "ui:title": "Slides",
      "ui:help":
        "Ordered list of slides. Each slide contains text, image, or interaction elements positioned on a 16:9 canvas.",
      items: {
        title: f("Slide title", "Optional caption shown in the corner of the slide."),
        background: {
          "ui:title": "Slide background",
          src: f("Background image URL"),
          color: f("Background color", "CSS color (e.g. #FCF8F2 or whitesmoke)."),
        },
        elements: {
          "ui:title": "Elements on this slide",
          "ui:help": "Pick text, image, or interaction. Each element has a normalized 0..1 rectangle.",
        },
      },
    },
    passPercentage: f(
      "Pass threshold (%)",
      "Default 70. Final score-as-percent must reach this for the activity to count as passed.",
    ),
    behaviour: {
      "ui:title": "Activity behaviour",
      showProgressBar: f("Show progress bar", "Display a slide-position indicator at the top."),
      showKeywords: f("Show keyword index", "Reserved for a future keyword-navigation panel."),
      enableRetry: f("Allow retry on embedded interactions"),
    },
    ui: {
      "ui:title": "Button label overrides",
      nextSlideButton: f("'Next' button text"),
      previousSlideButton: f("'Previous' button text"),
      finishButton: f("'Finish' button text"),
    },
  },

  "question-set": {
    ...COMMON,
    "ui:order": ["title", "questions", "passPercentage", "behaviour", "ui", "*"],
    title: TITLE,
    questions: {
      "ui:title": "Questions in this set",
      "ui:help":
        "An ordered series of questions. Each entry's `type` selects the activity shape (multiple choice or fill-in-the-blanks).",
      items: {
        type: {
          ...f("Question type", "Picks the activity shape used for the question."),
          "ui:enumNames": ["Multiple choice", "Fill in the blanks"],
        },
        config: f("Activity config", "The full config for the picked question type."),
        weight: f(
          "Weight",
          "Optional. Defaults to 1. Higher weight = this question contributes more to the final score.",
        ),
      },
    },
    passPercentage: f(
      "Pass threshold (%)",
      "Default 50. Aggregated weighted percent must reach this for the set to count as passed.",
    ),
    behaviour: {
      "ui:title": "Activity behaviour",
      randomQuestions: f("Randomize question order", "Shuffle question order each time the set loads."),
      showResults: f("Show per-question results", "Reveal correctness per question after Submit Set."),
      enableRetry: BEHAVIOUR_RETRY,
      showProgressBar: f("Show progress bar", "Display a 'Question N of M' indicator."),
    },
    ui: {
      "ui:title": "Button label overrides",
      nextQuestionButton: f("'Next' button text"),
      previousQuestionButton: f("'Previous' button text"),
      submitSetButton: f("'Submit set' button text"),
      tryAgainButton: f("'Try Again' button text"),
    },
  },

  "hotspot-3d": {
    ...COMMON,
    "ui:order": ["title", "prompt", "model", "camera", "hotspots", "behaviour", "ui", "*"],
    title: TITLE,
    prompt: f(
      "Prompt shown to the learner",
      "Tells the learner what part to identify. Use the toolbar to format text.",
      { "ui:widget": "html", "ui:options": { rows: 3 } },
    ),
    model: {
      "ui:title": "3D model",
      src: f(
        "Model file (.glb / .gltf)",
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
      scale: f("Uniform scale", "Multiplies model size by this factor. Default 1."),
      rotation: f("Initial rotation", "Optional XYZ rotation in radians."),
      position: f("Initial position", "Optional XYZ offset in scene units."),
    },
    camera: {
      "ui:title": "Camera setup",
      mode: {
        ...f("Camera mode", "Orbit lets the learner rotate around the model. Fixed locks the view."),
        "ui:enumNames": ["Orbit (rotate around model)", "Fixed view"],
      },
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
        id: f("Internal ID", "Unique identifier. Lowercase, no spaces."),
        label: f(
          "Label",
          "Shown in the keyboard fallback list and as a 3D marker chip when markers are visible.",
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
      singlePoint: f(
        "All-or-nothing scoring",
        "Hotspot is binary anyway — usually leave on.",
      ),
    },
    ui: {
      "ui:title": "Button label overrides",
      tryAgainButton: f("'Try Again' button text"),
      resetViewButton: f("'Reset view' button text"),
    },
  },

  "hotspot-2d": {
    ...COMMON,
    "ui:order": ["title", "prompt", "image", "hotspots", "behaviour", "ui", "*"],
    title: TITLE,
    prompt: f(
      "Prompt shown to the learner",
      "Tells the learner what region to find. Use the toolbar to format text.",
      { "ui:widget": "html", "ui:options": { rows: 3 } },
    ),
    image: {
      "ui:title": "Image",
      src: f("Image", "Paste a URL or upload a file. Files embed inline in the JSON.", {
        "ui:widget": "file",
        "ui:options": { accept: "image/*", maxSizeMb: 5, kind: "image" },
      }),
      alt: f(
        "Alt text",
        "Describes the image for screen-reader users. Empty if purely decorative.",
      ),
    },
    hotspots: {
      "ui:title": "Hotspots",
      "ui:help":
        "Rectangles overlaid on the image. Exactly one should be marked correct. Edit positions visually in the Edit-mode tab once that lands.",
      items: {
        id: f("Internal ID", "Unique identifier. Lowercase, no spaces."),
        label: f("Label", "Shown on the marker chip and in the keyboard fallback list."),
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
      singlePoint: f("All-or-nothing scoring", "Hotspot is binary anyway — usually leave on."),
    },
    ui: {
      "ui:title": "Button label overrides",
      tryAgainButton: f("'Try Again' button text"),
    },
  },

  "virtual-tour": {
    ...COMMON,
    "ui:order": ["title", "scene", "movement", "overlays", "completion", "behaviour", "ui", "*"],
    title: TITLE,
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
        yaw: f("Spawn yaw (degrees)", "Initial look direction. 0 = facing +Z."),
      },
    },
    movement: {
      "ui:title": "Movement controls",
      mode: {
        ...f(
          "Movement mode",
          "First-person: WASD + click-to-look. Click-to-move: tap a point to teleport. Hybrid: both.",
        ),
        "ui:enumNames": ["First-person (WASD + look)", "Click to move", "Hybrid (both)"],
      },
      speed: f("Movement speed", "Higher = faster walk. Try 2 for a slow tour, 5 for a brisk one."),
      navmeshConstrained: f(
        "Constrain to navmesh",
        "If on, movement is limited to a baked walkable area. Recommended for outdoor scenes.",
      ),
    },
    overlays: {
      "ui:title": "Points of interest",
      "ui:help":
        "Clickable or proximity-triggered info panels. Each opens a modal with text, images, and audio.",
      items: {
        id: f("Internal ID", "Unique identifier. Lowercase, no spaces."),
        title: f("Display title", "Shown above the overlay panel and on the marker chip."),
        position: f("World position (x, y, z)"),
        trigger: {
          ...f("Trigger", "How the overlay panel opens for the learner."),
          "ui:enumNames": ["On click / tap", "When learner is nearby"],
        },
        proximityRadius: f(
          "Proximity radius",
          "How close the learner must be (in scene units) to auto-trigger. Only used when trigger=proximity.",
        ),
        icon: f("Marker icon URL", "Optional billboard icon shown on the marker."),
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
      showMinimap: f("Show minimap", "Reserved for a future top-down minimap UI."),
      enableRetry: f("Allow retry", "Allow the learner to restart the tour after completing."),
      showOverlayMarkers: f(
        "Show overlay markers",
        "When on, learners see labeled chips floating at each overlay's position.",
      ),
    },
    ui: {
      "ui:title": "Button label overrides",
      doneButton: f("'Done' button text"),
      closeOverlayButton: f("Close-overlay button label"),
    },
  },

  "sequence-steps": {
    ...COMMON,
    "ui:order": ["title", "prompt", "steps", "behaviour", "ui", "*"],
    title: TITLE,
    prompt: f("Prompt", "What the learner is asked to put in order.", {
      "ui:widget": "html",
      "ui:options": { rows: 3 },
    }),
    steps: {
      "ui:title": "Steps (in correct order)",
      "ui:help":
        "List the steps in the correct sequence. Learners see them shuffled (when randomize is on) and reorder via drag.",
      items: {
        id: f("Internal ID", "Unique identifier. Lowercase, no spaces."),
        text: f("Step text", "What the learner sees on the row."),
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
      singlePoint: BEHAVIOUR_SINGLEPOINT,
      randomize: f("Shuffle on load", "When on, present steps in a random initial order."),
    },
    ui: {
      "ui:title": "Button label overrides",
      checkAnswerButton: f("'Check' button text"),
      tryAgainButton: f("'Try Again' button text"),
    },
  },

  "matching-pairs": {
    ...COMMON,
    "ui:order": ["title", "prompt", "pairs", "behaviour", "ui", "*"],
    title: TITLE,
    prompt: f("Prompt", "Tells the learner what to match.", {
      "ui:widget": "html",
      "ui:options": { rows: 3 },
    }),
    pairs: {
      "ui:title": "Pairs (left ↔ right)",
      "ui:help":
        "Each row defines a correct match between a left-column item and a right-column item.",
      items: {
        id: f("Internal ID", "Unique identifier."),
        left: { "ui:title": "Left item", text: f("Text", "What the learner sees on the left side.") },
        right: {
          "ui:title": "Right item (correct partner)",
          text: f("Text", "What the learner sees on the right side."),
        },
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
      singlePoint: BEHAVIOUR_SINGLEPOINT,
      randomizeRight: f(
        "Shuffle the right column",
        "Default on. The right side is shuffled so learners can't pair by position.",
      ),
    },
    ui: {
      "ui:title": "Button label overrides",
      checkAnswerButton: f("'Check' button text"),
      tryAgainButton: f("'Try Again' button text"),
    },
  },

  categorization: {
    ...COMMON,
    "ui:order": ["title", "prompt", "categories", "items", "behaviour", "ui", "*"],
    title: TITLE,
    prompt: f("Prompt", "Tells the learner what to sort.", {
      "ui:widget": "html",
      "ui:options": { rows: 3 },
    }),
    categories: {
      "ui:title": "Categories (bins)",
      "ui:help": "The named bins items can be dropped into.",
      items: {
        id: f("Internal ID"),
        label: f("Bin label", "Shown above the bin."),
      },
    },
    items: {
      "ui:title": "Items to sort",
      "ui:help": "Each item declares which category id is its correct home.",
      items: {
        id: f("Internal ID"),
        text: f("Item text", "What the learner sees on the chip."),
        correctCategory: f(
          "Correct category id",
          "Must match one of the category ids declared above.",
        ),
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
      singlePoint: BEHAVIOUR_SINGLEPOINT,
      randomizeItems: f("Shuffle items on load", "When on, the tray order is randomized."),
    },
    ui: {
      "ui:title": "Button label overrides",
      checkAnswerButton: f("'Check' button text"),
      tryAgainButton: f("'Try Again' button text"),
    },
  },

  "anatomy-labeling": {
    ...COMMON,
    "ui:order": ["title", "prompt", "image", "labels", "targets", "behaviour", "ui", "*"],
    title: TITLE,
    prompt: f("Prompt", "Tells the learner what to label.", {
      "ui:widget": "html",
      "ui:options": { rows: 3 },
    }),
    image: {
      "ui:title": "Image",
      src: f("Image", "Paste a URL or upload a file. Files embed inline in the JSON.", {
        "ui:widget": "file",
        "ui:options": { accept: "image/*", maxSizeMb: 5, kind: "image" },
      }),
      alt: f("Alt text", "Description for screen-reader users. Empty if purely decorative."),
    },
    labels: {
      "ui:title": "Labels",
      "ui:help": "Each label declares which target id is its correct home.",
      items: {
        id: f("Internal ID"),
        text: f("Label text"),
        correctTargetId: f("Correct target id", "Must match one of the target ids declared below."),
      },
    },
    targets: {
      "ui:title": "Targets (numbered points)",
      "ui:help": "Each target is a small numbered circle on the image.",
      items: {
        id: f("Internal ID"),
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
  },

  "image-comparison-slider": {
    ...COMMON,
    "ui:order": ["title", "prompt", "before", "after", "initialPosition", "behaviour", "ui", "*"],
    title: TITLE,
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
      alt: f("Alt text"),
      caption: f("Caption", "Optional. Shown beneath the image."),
    },
    after: {
      "ui:title": "After image",
      src: f("Image", "Paste URL or upload.", {
        "ui:widget": "file",
        "ui:options": { accept: "image/*", maxSizeMb: 5, kind: "image" },
      }),
      alt: f("Alt text"),
      caption: f("Caption", "Optional."),
    },
    initialPosition: f(
      "Initial seam position (0..1)",
      "Where the seam starts. 0 = before fills the canvas; 1 = after fills the canvas. Default 0.5.",
    ),
    behaviour: {
      "ui:title": "Activity behaviour",
      autoSnap: f("Auto-snap to centre on release", "Seam returns to 0.5 when the learner lets go."),
    },
    ui: {
      "ui:title": "Button label overrides",
      doneButton: f("'Done' button text"),
    },
  },

  "highlight-text": {
    ...COMMON,
    "ui:order": ["title", "prompt", "tokens", "behaviour", "ui", "*"],
    title: TITLE,
    prompt: f("Prompt", "Tells the learner what to highlight.", {
      "ui:widget": "html",
      "ui:options": { rows: 3 },
    }),
    tokens: {
      "ui:title": "Tokens (each is clickable)",
      "ui:help":
        "Render order matters — tokens render with single spaces between unless a separator is set.",
      items: {
        id: f("Internal ID"),
        text: f("Token text", "The word or phrase the learner sees."),
        correct: f("Counts as correct", "Selecting this token contributes to the score."),
        separator: f(
          "Separator after token",
          "Optional. Defaults to a single space. Set to an empty string for no space, or to ', ' / '. ' / etc.",
        ),
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
      singlePoint: BEHAVIOUR_SINGLEPOINT,
    },
    ui: {
      "ui:title": "Button label overrides",
      checkAnswerButton: f("'Check' button text"),
      tryAgainButton: f("'Try Again' button text"),
    },
  },

  flashcards: {
    ...COMMON,
    "ui:order": ["title", "prompt", "cards", "behaviour", "ui", "*"],
    title: TITLE,
    prompt: f("Intro / instructions", "Optional intro shown above the deck.", {
      "ui:widget": "html",
      "ui:options": { rows: 2 },
    }),
    cards: {
      "ui:title": "Cards",
      "ui:help": "Each card has a front and a back. HTML allowed in both.",
      items: {
        id: f("Internal ID"),
        front: f("Front (question side)", "What the learner sees first.", {
          "ui:widget": "html",
          "ui:options": { rows: 2 },
        }),
        back: f("Back (answer side)", "Revealed when the card flips.", {
          "ui:widget": "html",
          "ui:options": { rows: 2 },
        }),
        hint: f("Hint", "Optional hint shown alongside the front.", {
          "ui:widget": "textarea",
          "ui:options": { rows: 2 },
        }),
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      shuffle: f("Shuffle the deck", "Default on."),
      passThreshold: f(
        "Pass threshold (% knew)",
        "Default 80. Score-as-percent of cards marked 'I knew it' must reach this for the activity to pass.",
      ),
    },
    ui: {
      "ui:title": "Button label overrides",
      knewItButton: f("'I knew it' button text"),
      didntKnowButton: f("'I didn't know it' button text"),
      nextButton: f("'Next' button text"),
    },
  },

  "reflection-prompt": {
    ...COMMON,
    "ui:order": ["title", "prompt", "minWords", "placeholder", "ui", "*"],
    title: TITLE,
    prompt: f("Prompt", "What the learner reflects on.", {
      "ui:widget": "html",
      "ui:options": { rows: 4 },
    }),
    minWords: f(
      "Minimum word count",
      "Optional. If set, Submit is disabled until the learner writes this many words.",
    ),
    placeholder: f("Placeholder text", "Greys-out hint inside the empty textarea."),
    ui: {
      "ui:title": "Button label overrides",
      submitButtonLabel: f("'Submit' button text"),
    },
  },

  // Stubbed (planned) activity kinds get filled in below.
} as unknown as Record<ActivityKind, Record<string, unknown>>;

// Inject a minimal stub uiSchema for every planned kind. PLANNED_ACTIVITY_KINDS
// is currently empty (every spec'd activity has shipped) — this loop is a
// future hook for when the catalog grows again.
for (const kind of PLANNED_ACTIVITY_KINDS) {
  (UI_SCHEMAS as Record<string, unknown>)[kind] = {
    ...COMMON,
    title: f("Activity title", "What learners and instructors see in the gradebook."),
    description: f("Description", "Short summary of what the activity will do.", {
      "ui:widget": "textarea",
      "ui:options": { rows: 2 },
    }),
    notes: f("Author notes", "Use this space to draft requirements or design ideas.", {
      "ui:widget": "textarea",
      "ui:options": { rows: 6 },
    }),
  };
}
