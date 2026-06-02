/**
 * RJSF uiSchema for the video-reflection activity. Drives Studio's form
 * editor — field order, labels, help text, widget choices. Hand-tuned;
 * mirrors the sibling audio-recording ui-schema idioms.
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
    "submissionTarget",
    "minDurationSeconds",
    "maxDurationSeconds",
    "behaviour",
    "ui",
    "*",
  ],
  title: TITLE,
  author: AUTHOR,
  prompt: f("Prompt", "What the learner reflects on.", {
    "ui:widget": "html",
    "ui:options": { rows: 3 },
  }),
  submissionTarget: f(
    "Where to submit (optional)",
    "Named in the submit step, e.g. \"the Reflection 1 dropbox in Lamakū\". The learner downloads their video and uploads it there — the video is not sent through Kukui.",
  ),
  minDurationSeconds: f("Minimum seconds", "Optional. Submit disabled until met."),
  maxDurationSeconds: f(
    "Maximum seconds",
    "Optional. Recording auto-stops at this length. Keep reflections short — videos are downloaded and uploaded to your LMS dropbox, not stored by Kukui.",
  ),
  behaviour: {
    "ui:title": "Activity behaviour",
    allowReRecord: f("Allow re-record", "Let the learner discard a take and record again."),
    allowScreenShare: f(
      "Offer screen share",
      "Where the browser supports it (desktop), let the learner share their screen with a webcam picture-in-picture. Ignored on devices without screen capture (e.g. iPhone/iPad), which fall back to camera-only.",
    ),
    cameraShape: f(
      "Webcam bubble shape",
      "Shape of the webcam picture-in-picture when sharing a screen: a rounded-corner frame (keeps the full camera view) or a circle (a cropped face bubble).",
      { "ui:widget": "radio" },
    ),
  },
  ui: {
    "ui:title": "Button label overrides",
    recordButton: f("'Record' button text"),
    stopButton: f("'Stop' button text"),
    reRecordButton: f("'Re-record' button text"),
    downloadButton: f("'Download' button text"),
    submitButton: f("'Submit' button text"),
  },
} as const;

export default uiSchema;
