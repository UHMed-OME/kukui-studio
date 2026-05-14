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

/**
 * Shared uiSchema for the `appearance` block (theme pin). Lives in
 * COMMON so every activity's Editor form gets a labeled "Appearance"
 * section with the theme dropdown labeled "Color scheme" — without
 * needing per-activity ui:order entries (the * glob picks it up).
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

/** Compact builder: f(label, help, opts?) → uiSchema fragment for a leaf field. */
function f(title: string, help?: string, extra: Record<string, unknown> = {}) {
  return {
    "ui:title": title,
    ...(help ? { "ui:help": help } : {}),
    ...extra,
  };
}

/**
 * Numeric inputs sized to typical authoring needs:
 *   - NORM01: 0..1 normalized coordinates / fractions (rect, position, etc.)
 *   - PERCENT: integer percentages 0..100 (feedback bands)
 *   - WHOLE: integer counts ≥0 (capacity, words)
 * `step` shows up as the input's HTML step attribute, which both
 * validates manual entry and drives the spinner increment.
 */
const NORM01 = { "ui:options": { step: 0.01, min: 0, max: 1 } } as const;
const PERCENT = { "ui:options": { step: 1, min: 0, max: 100 } } as const;
const WHOLE = { "ui:options": { step: 1, min: 0 } } as const;

const TITLE = f("Activity title", "Shown at the top of the activity and as the SCORM activity name.");

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

/**
 * Shared uiSchema fragment for the `live` section of every live
 * activity. Keeps the join + admin keys top-of-form (rendered with
 * the password-copy widget) and labels the transport overrides as
 * advanced.
 */
const LIVE_SETTINGS_UI = {
  "ui:title": "Live session keys",
  "ui:options": { advanced: false },
  "ui:help":
    "Auto-generated when you start a new draft or hit Reset. Tap Show to read the values; tap Copy to put them on your clipboard. Replace if you want a specific room name.",
  "ui:order": ["joinKey", "adminKey", "signaling", "relayUrls"],
  joinKey: f(
    "Join key (public)",
    "Hashed to derive the room id. Same key in two copies of this activity = same mesh. Safe to share with students; this is what they need to enter the room.",
    { "ui:widget": "passwordCopy", "ui:options": { copyHint: "Copy join key" } },
  ),
  adminKey: f(
    "Admin key (private)",
    "Secret that unlocks host controls. The 'Launch instructor view' button embeds this in the URL; in an LMS deploy, the instructor enters it via the lock icon in the activity. Keep off the syllabus.",
    { "ui:widget": "passwordCopy", "ui:options": { copyHint: "Copy admin key" } },
  ),
  signaling: f(
    "Signaling backend (advanced)",
    "Nostr (default) is federated WebSocket signaling — usually permitted on edu networks. MQTT is the fallback if Nostr is blocked.",
  ),
  relayUrls: f(
    "Pinned relay URLs (advanced, optional)",
    "Optional list of relay/broker URLs to use instead of Trystero's defaults. Pin to relays you've verified work on your institution's network.",
  ),
} as const;

export const UI_SCHEMAS: Record<ActivityKind, Record<string, unknown>> = {
  "multiple-choice": {
    ...COMMON,
    "ui:order": ["title", "question", "answers", "behaviour", "ui", "overallFeedback", "*"],
    title: TITLE,
    author: AUTHOR,
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
    overallFeedback: HIDDEN,
  },

  "fill-in-the-blanks": {
    ...COMMON,
    "ui:order": ["title", "text", "behaviour", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
    text: f(
      "Question text with blanks",
      "Wrap each blank in asterisks, like *answer*. Use / or | for alternate accepted answers, e.g. *Honolulu/O'ahu*.",
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
        "Allows answers off by one letter (a single typo, missing letter, or extra letter).",
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
    "ui:order": ["title", "prompt", "background", "draggables", "dropZones", "behaviour", "ui", "*"],
    title: TITLE,
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
  },

  "question-set": {
    ...COMMON,
    "ui:order": ["title", "questions", "passPercentage", "behaviour", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
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
    passPercentage: HIDDEN,
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
    author: AUTHOR,
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
  },

  "hotspot-2d": {
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
  },

  "virtual-tour": {
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
  },

  "sequence-steps": {
    ...COMMON,
    "ui:order": ["title", "prompt", "steps", "behaviour", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
    prompt: f("Prompt", "What the learner is asked to put in order.", {
      "ui:widget": "html",
      "ui:options": { rows: 3 },
    }),
    steps: {
      "ui:title": "Steps (in correct order)",
      "ui:help":
        "List the steps in the correct sequence. Learners see them shuffled (when randomize is on) and reorder via drag.",
      items: {
        id: HIDDEN,
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
    author: AUTHOR,
    prompt: f("Prompt", "Tells the learner what to match.", {
      "ui:widget": "html",
      "ui:options": { rows: 3 },
    }),
    pairs: {
      "ui:title": "Pairs (left ↔ right)",
      "ui:help":
        "Each row defines a correct match between a left-column item and a right-column item.",
      items: {
        id: HIDDEN,
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
    author: AUTHOR,
    prompt: f("Prompt", "Tells the learner what to sort.", {
      "ui:widget": "html",
      "ui:options": { rows: 3 },
    }),
    categories: {
      "ui:title": "Categories (bins)",
      "ui:help": "The named bins items can be dropped into.",
      items: {
        id: HIDDEN,
        label: f("Bin label", "Shown above the bin."),
      },
    },
    items: {
      "ui:title": "Items to sort",
      "ui:help": "Each item declares which category id is its correct home.",
      items: {
        id: HIDDEN,
        text: f("Item text", "What the learner sees on the item card."),
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
  },

  "image-comparison-slider": {
    ...COMMON,
    "ui:order": ["title", "prompt", "before", "after", "initialPosition", "behaviour", "ui", "*"],
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
    "ui:order": ["title", "prompt", "tokens", "behaviour", "ui", "overallFeedback", "*"],
    title: TITLE,
    author: AUTHOR,
    prompt: f("Prompt", "Tells the learner what to highlight.", {
      "ui:widget": "html",
      "ui:options": { rows: 3 },
    }),
    tokens: {
      "ui:title": "Tokens (each is clickable)",
      "ui:help":
        "Render order matters — tokens render with single spaces between unless a separator is set.",
      items: {
        id: HIDDEN,
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
    overallFeedback: HIDDEN,
  },

  flashcards: {
    ...COMMON,
    "ui:order": ["title", "prompt", "cards", "behaviour", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
    prompt: f("Intro / instructions", "Optional intro shown above the deck.", {
      "ui:widget": "html",
      "ui:options": { rows: 2 },
    }),
    cards: {
      "ui:title": "Cards",
      "ui:help": "Each card has a front and a back. HTML allowed in both.",
      items: {
        id: HIDDEN,
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
    },
    ui: {
      "ui:title": "Button label overrides",
      gotItButton: f("'Got it' button text", "Label shown after the learner flips a card and remembered the answer."),
      reviewAgainButton: f("'Review again' button text", "Label shown after the learner flips a card and wants to revisit it."),
      nextButton: f("'Reveal answer' / next button text"),
    },
  },

  "reflection-prompt": {
    ...COMMON,
    "ui:order": ["title", "prompt", "minWords", "placeholder", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
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

  "image-annotation": {
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
    title: TITLE,
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
        "Required for accessibility — describe what the image shows in one short sentence.",
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
  },

  "branching-scenario": {
    ...COMMON,
    "ui:order": ["title", "startNodeId", "nodes", "behaviour", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
    startNodeId: f("Starting step", "Which step the learner sees first.", {
      "ui:widget": "nodeSelect",
    }),
    nodes: {
      "ui:title": "Scenario steps",
      "ui:help":
        "Each step shows a prompt, then either a list of choices that lead elsewhere or a final outcome.",
      items: {
        id: HIDDEN,
        prompt: f("Prompt", "Shown when the learner reaches this step.", {
          "ui:widget": "html",
        }),
        choices: {
          "ui:title": "Choices",
          items: {
            id: HIDDEN,
            text: f("Choice text", "What the learner sees on the button."),
            nextNodeId: f("Goes to step", "Which step this choice leads to.", {
              "ui:widget": "nodeSelect",
            }),
            feedback: f("Feedback (optional)", "Shown when this choice is picked.", {
              "ui:widget": "textarea",
              "ui:options": { rows: 2 },
            }),
          },
        },
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
    },
    ui: {
      "ui:title": "Button label overrides",
      restartButton: f("'Restart' button text"),
    },
  },

  "concept-map": {
    ...COMMON,
    "ui:order": [
      "title",
      "prompt",
      "seedNodes",
      "availableConcepts",
      "expected",
      "behaviour",
      "ui",
      "*",
    ],
    title: TITLE,
    author: AUTHOR,
    prompt: f("Prompt", "What the learner builds a concept map of.", {
      "ui:widget": "html",
      "ui:options": { rows: 3 },
    }),
    seedNodes: {
      "ui:title": "Starter nodes",
      "ui:help": "Optional. Nodes the learner sees pre-placed on the canvas.",
      items: {
        id: HIDDEN,
        label: f("Label", "Visible node text."),
      },
    },
    availableConcepts: {
      "ui:title": "Concept palette",
      "ui:help": "Optional. Concepts the learner can drag onto the canvas.",
      items: {
        id: HIDDEN,
        label: f("Label", "Visible label text."),
      },
    },
    expected: {
      "ui:title": "Expected (ground-truth) map",
      nodes: f("Required node labels", "Optional. Labels the learner must include."),
      edges: {
        "ui:title": "Required edges",
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
      allowFreeText: f(
        "Allow free-text nodes",
        "When on, the learner can add nodes outside the seed set.",
      ),
    },
    ui: {
      "ui:title": "Button label overrides",
      submitButton: f("'Submit' button text"),
    },
  },

  "interactive-video": {
    ...COMMON,
    "ui:order": ["title", "prompt", "video", "interactions", "behaviour", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
    prompt: f("Prompt", "Optional. Shown above the player.", {
      "ui:widget": "html",
      "ui:options": { rows: 2 },
    }),
    video: {
      "ui:title": "Video source",
      src: f("Video URL", "MP4, YouTube, or Vimeo URL."),
      type: f("Source type", "html5 for direct MP4; otherwise youtube / vimeo."),
      poster: f("Poster image", "Optional. Shown before play."),
    },
    interactions: {
      "ui:title": "Time-coded interactions",
      "ui:help": "Each interaction pauses the video and renders a sub-activity.",
      items: {
        id: HIDDEN,
        kind: f("Interaction kind", "Which sub-activity to render."),
        required: f("Required", "Block playback resume until answered."),
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
      passPercentage: HIDDEN,
    },
    ui: {
      "ui:title": "Button label overrides",
      submitButtonLabel: f("'Submit' button text"),
    },
  },

  "audio-recording": {
    ...COMMON,
    "ui:order": ["title", "prompt", "sample", "minSeconds", "maxSeconds", "behaviour", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
    prompt: f("Prompt", "What the learner records.", {
      "ui:widget": "html",
      "ui:options": { rows: 3 },
    }),
    sample: {
      "ui:title": "Reference sample (optional)",
      src: f("Audio URL", "Optional sample for the learner to compare against."),
      caption: f("Caption"),
    },
    minSeconds: f("Minimum seconds", "Optional. Submit disabled until met."),
    maxSeconds: f(
      "Maximum seconds",
      "Optional. Recording auto-stops at this length. Note: SCORM 1.2 can only persist short clips (~5 seconds) across resume — longer recordings still submit and grade as completed, but won't replay if the learner returns to the activity.",
    ),
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
    },
    ui: {
      "ui:title": "Button label overrides",
      submitButtonLabel: f("'Submit' button text"),
    },
  },

  "lab-panel": {
    ...COMMON,
    "ui:order": ["title", "prompt", "panel", "interpretation", "behaviour", "ui", "overallFeedback", "*"],
    title: TITLE,
    author: AUTHOR,
    prompt: f("Clinical context", "Brief vignette shown above the lab panel.", {
      "ui:widget": "html",
      "ui:options": { rows: 4 },
    }),
    panel: {
      "ui:title": "Lab panel",
      name: f("Panel name", "e.g. 'Basic Metabolic Panel'."),
      values: {
        "ui:title": "Panel values",
        items: {
          id: HIDDEN,
          analyte: f("Analyte", "e.g. 'Sodium', 'WBC'."),
          result: f("Result", "Numeric or qualitative value."),
          units: f("Units"),
          reference: f("Reference range"),
          flag: f("Flag", "high / low / normal — colour-codes the row."),
        },
      },
    },
    interpretation: {
      "ui:title": "Interpretation question",
      question: f("Question", "What the learner is asked after reading the panel."),
      choices: {
        "ui:title": "Answer choices",
        items: {
          id: HIDDEN,
          text: f("Answer text"),
          correct: f("Correct"),
          feedback: f("Feedback", "Optional. Shown when this choice is picked."),
        },
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
    overallFeedback: HIDDEN,
  },

  "ddx-tree": {
    ...COMMON,
    "ui:order": ["title", "startNodeId", "nodes", "behaviour", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
    startNodeId: f("Starting step", "First presentation the learner sees.", {
      "ui:widget": "nodeSelect",
    }),
    nodes: {
      "ui:title": "Differential diagnosis steps",
      "ui:help":
        "Each step has a clinical presentation, then a list of choices that lead elsewhere or a final diagnosis.",
      items: {
        id: HIDDEN,
        presentation: f(
          "Presentation",
          "Vignette / patient context shown at this step.",
          { "ui:widget": "html" },
        ),
        choices: {
          "ui:title": "Choices",
          items: {
            id: HIDDEN,
            text: f("Choice text"),
            nextNodeId: f("Goes to step", "Which step this choice leads to.", {
              "ui:widget": "nodeSelect",
            }),
            feedback: f("Feedback (optional)", undefined, {
              "ui:widget": "textarea",
              "ui:options": { rows: 2 },
            }),
          },
        },
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
    },
    ui: {
      "ui:title": "Button label overrides",
      restartButton: f("'Restart' button text"),
    },
  },

  osce: {
    ...COMMON,
    "ui:order": ["title", "phases", "expectedOrder", "behaviour", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
    phases: {
      "ui:title": "Encounter phases",
      "ui:help":
        "Each phase has a name and a list of actions the learner can take. Author marks which actions are correct.",
      items: {
        id: HIDDEN,
        name: f("Phase name", "e.g. 'History', 'Examination', 'Closure'."),
        description: f("Description", "Optional. Shown when the phase opens."),
      },
    },
    expectedOrder: f(
      "Expected phase order",
      "Optional. Phase ids in the order the learner should perform them.",
    ),
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
      allowSkipPhase: f(
        "Allow free phase navigation",
        "Lets the learner jump between phases via the stepper. Off = linear (next/back) only.",
      ),
      guessPenalty: f(
        "Wrong-answer penalty (0..1)",
        "How much each wrong selection subtracts from a phase's earned points. Default 1; set to 0 to remove the penalty entirely.",
        { "ui:options": { step: 0.1, min: 0, max: 1 } },
      ),
    },
    ui: {
      "ui:title": "Button label overrides",
      submitButtonLabel: f("'Submit' button text"),
    },
  },

  "straw-poll": {
    ...COMMON,
    "ui:order": ["title", "prompt", "choices", "behaviour", "live", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
    prompt: f(
      "Poll prompt",
      "The question the instructor projects and students answer. Keep it short — straw polls are temperature checks, not essay prompts.",
      { "ui:widget": "textarea", "ui:options": { rows: 2 } },
    ),
    choices: {
      "ui:title": "Choices",
      "ui:help":
        "2–8 options. Each choice gets a button on the student view and a bar in the live tally; long labels wrap to the second line, so keep them brief.",
      items: {
        id: HIDDEN,
        label: f("Choice label", "Shown to students and as the bar label in the tally."),
        description: f(
          "Choice description (optional)",
          "Brief hint under the label — useful when the label is a single word that needs context.",
        ),
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      showLiveResultsToStudents: f(
        "Show live counts to students after they vote",
        "Default on. Turn off for high-stakes polls where seeing others' answers would bias the response — the tally then only appears at reveal.",
      ),
      allowChangeVote: f(
        "Allow students to change their vote",
        "Default on. Each student's latest tap wins. Turn off to lock the first vote in.",
      ),
      showIndividualVotes: f(
        "Show individual votes to the instructor",
        "Default off (aggregate only). Enabling this lists each voter and their pick — use only when the poll is openly attributed.",
      ),
    },
    ui: {
      "ui:title": "Button label overrides",
      openPollButton: f("'Open poll' button text"),
      closePollButton: f("'Close & reveal' button text"),
      revealButton: f("'Reveal' button text"),
      resetButton: f("'Reset' button text"),
      submitVoteButton: f("'Submit vote' button text"),
      changeVoteButton: f("'Change vote' button text"),
    },
    live: LIVE_SETTINGS_UI,
  },

  "confidence-meter": {
    ...COMMON,
    "ui:order": ["title", "prompt", "scale", "behaviour", "live", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
    prompt: f(
      "Prompt",
      "The question students rate themselves against. One sentence works best.",
      { "ui:widget": "textarea", "ui:options": { rows: 2 } },
    ),
    scale: {
      "ui:title": "Slider scale",
      min: f("Minimum", "Default 0."),
      max: f("Maximum", "Default 100. Higher = more confident."),
      step: f("Step size", "Increment per slider tick. 1 is fine for percentages; 5 or 10 for coarser scales."),
      lowLabel: f("Low-end label", "Tooltip shown next to the slider's minimum (e.g. 'Lost')."),
      highLabel: f("High-end label", "Tooltip shown next to the slider's maximum (e.g. 'Could teach it back')."),
      unit: f("Unit", "Suffix shown beside numeric values (e.g. '%'). Optional."),
    },
    behaviour: {
      "ui:title": "Behaviour",
      showLiveResultsToStudents: f(
        "Show live histogram to students",
        "Default on. Turn off for blind ratings (students don't see classmates' values until reveal).",
      ),
      allowChangeRating: f("Allow students to change their rating", "Default on; last drag wins."),
    },
    ui: { "ui:title": "Button label overrides" },
    live: LIVE_SETTINGS_UI,
  },

  "word-cloud": {
    ...COMMON,
    "ui:order": [
      "title",
      "prompt",
      "submissionsPerStudent",
      "maxWordsPerSubmission",
      "maxCharsPerSubmission",
      "behaviour",
      "live",
      "ui",
      "*",
    ],
    title: TITLE,
    author: AUTHOR,
    prompt: f(
      "Prompt",
      "Frame the response — e.g. 'Sum up today's lecture in one or two words'. Short answers are the whole point; longer prompts dilute the cloud.",
      { "ui:widget": "textarea", "ui:options": { rows: 2 } },
    ),
    submissionsPerStudent: f(
      "Submissions per student",
      "Default 1. Raise to 2 or 3 for richer clouds in smaller classes (×N entries each).",
    ),
    maxWordsPerSubmission: f(
      "Max words per submission",
      "Default 2. Keep low (1–3) so the cloud aggregates meaningfully.",
    ),
    maxCharsPerSubmission: f(
      "Max characters per submission",
      "Hard cap on submission length. 24 is a good default for a few words.",
    ),
    behaviour: {
      "ui:title": "Behaviour",
      showLiveResultsToStudents: f(
        "Show live cloud to students",
        "Default on. Turn off if seeing peer answers would prime students.",
      ),
      caseSensitive: f(
        "Case-sensitive tally",
        "Default off — 'apple' and 'Apple' merge. Turn on for case-distinct content (gene names, acronyms).",
      ),
    },
    ui: { "ui:title": "Button label overrides" },
    live: LIVE_SETTINGS_UI,
  },

  "qa-board": {
    ...COMMON,
    "ui:order": [
      "title",
      "prompt",
      "maxQuestionsPerStudent",
      "maxQuestionLength",
      "behaviour",
      "live",
      "ui",
      "*",
    ],
    title: TITLE,
    author: AUTHOR,
    prompt: f(
      "Prompt",
      "Frame the backchannel — e.g. 'Post any questions you have during lecture'. Short.",
      { "ui:widget": "textarea", "ui:options": { rows: 2 } },
    ),
    maxQuestionsPerStudent: f(
      "Max questions per student",
      "Default 5. Caps spam; raise for long lectures.",
    ),
    maxQuestionLength: f("Max characters per question", "Default 240."),
    behaviour: {
      "ui:title": "Behaviour",
      allowAnonymous: f(
        "Show questions as anonymous",
        "Default on. Instructor still sees the author for moderation; classmates don't.",
      ),
      allowUpvoteOwn: f("Allow upvoting your own question", "Default off."),
      showAnsweredBelow: f(
        "Move answered questions below open ones",
        "Default on. Keeps the active queue at the top.",
      ),
    },
    ui: { "ui:title": "Button label overrides" },
    live: LIVE_SETTINGS_UI,
  },

  "quick-quiz": {
    ...COMMON,
    "ui:order": ["title", "prompt", "choices", "behaviour", "live", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
    prompt: f(
      "Question",
      "Single question. For multiple questions, run a few Quick Quizzes back-to-back.",
      { "ui:widget": "textarea", "ui:options": { rows: 2 } },
    ),
    choices: {
      "ui:title": "Choices",
      "ui:help":
        "2–6 options. Tick the box on the correct one. At least one choice must be marked correct.",
      items: {
        id: HIDDEN,
        label: f("Choice text", "What the student sees on the answer button."),
        correct: f(
          "Correct answer",
          "Check this on the right answer. At least one choice must be marked.",
        ),
      },
    },
    behaviour: {
      "ui:title": "Behaviour",
      showLiveResultsToStudents: f(
        "Show live tally to students before reveal",
        "Default off. Most quizzes want students to commit before seeing the herd.",
      ),
      revealCorrectAnswer: f("Highlight the correct answer at reveal", "Default on."),
      allowChangeAnswer: f("Allow students to change their answer", "Default on; last tap wins."),
      showNamesAtReveal: f(
        "Show student names with correct answers at reveal",
        "Default off (anonymous). Turn on for kahoot-style leaderboards.",
      ),
    },
    ui: { "ui:title": "Button label overrides" },
    live: LIVE_SETTINGS_UI,
  },

  crossword: {
    ...COMMON,
    "ui:order": ["title", "prompt", "entries", "behaviour", "ui", "*"],
    title: TITLE,
    author: AUTHOR,
    prompt: f(
      "Prompt",
      "Optional. Shown above the puzzle — frame the topic or give solving instructions.",
      { "ui:widget": "textarea", "ui:options": { rows: 2 } },
    ),
    entries: {
      "ui:title": "Terms & definitions",
      "ui:help":
        "Each entry is one word in the crossword paired with the clue learners see. Terms must be 2–32 A–Z letters (no spaces or punctuation). Add at least 2 entries; aim for 6–12 for a satisfying puzzle.",
      items: {
        id: HIDDEN,
        term: f(
          "Term (answer)",
          "The word learners must fill in. Letters only (A–Z). Case is ignored — it always renders in upper case.",
        ),
        definition: f("Definition (clue)", "The clue shown in the Across/Down list."),
        hint: f(
          "Hint (optional)",
          "Surfaces when the learner selects this clue, if hints are enabled.",
        ),
      },
    },
    behaviour: {
      "ui:title": "Activity behaviour",
      enableRetry: BEHAVIOUR_RETRY,
      allowReshuffle: f(
        "Allow 'New layout'",
        "Let the learner regenerate the grid for a fresh arrangement of the same terms.",
      ),
      allowReveal: f(
        "Allow 'Reveal letter / word'",
        "Reveal buttons fill in the answer; revealed cells don't count toward the grade.",
      ),
      showHints: f(
        "Show hint affordance",
        "Renders a hint banner for the active clue when its entry has a hint.",
      ),
    },
    ui: {
      "ui:title": "Button label overrides",
      checkButton: f("'Check' button text"),
      revealLetterButton: f("'Reveal letter' button text"),
      revealWordButton: f("'Reveal word' button text"),
      reshuffleButton: f("'New layout' button text"),
      submitButton: f("'Submit' button text"),
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
