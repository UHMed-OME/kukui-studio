/** RJSF uiSchema for the qa-board activity. Extracted from apps/studio-app/src/uiSchemas.ts. */

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

/**
 * Shared uiSchema fragment for the `live` section of every live
 * activity. Inlined here so this module is standalone.
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
    "Nostr (default) is federated WebSocket signaling, usually permitted on edu networks. MQTT is the fallback if Nostr is blocked.",
  ),
  relayUrls: f(
    "Pinned relay URLs (advanced, optional)",
    "Optional list of relay/broker URLs to use instead of Trystero's defaults. Pin to relays you've verified work on your institution's network.",
  ),
} as const;

const uiSchema = {
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
    "Frame the backchannel, e.g. 'Post any questions you have during lecture'. Keep it short.",
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
} as const;

export default uiSchema;
