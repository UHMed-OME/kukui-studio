/** RJSF uiSchema for the straw-poll activity. Extracted from apps/studio-app/src/uiSchemas.ts. */

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
  "ui:order": ["title", "prompt", "choices", "behaviour", "live", "ui", "*"],
  title: TITLE,
  author: AUTHOR,
  prompt: f(
    "Poll prompt",
    "The question the instructor projects and students answer. Keep it short; straw polls are temperature checks, not essay prompts.",
    { "ui:widget": "textarea", "ui:options": { rows: 2 } },
  ),
  choices: {
    "ui:title": "Choices",
    "ui:help":
      "2-8 options. Each choice gets a button on the student view and a bar in the live tally; long labels wrap to the second line, so keep them brief.",
    items: {
      id: HIDDEN,
      label: f("Choice label", "Shown to students and as the bar label in the tally."),
      description: f(
        "Choice description (optional)",
        "Brief hint under the label, useful when the label is a single word that needs context.",
      ),
    },
  },
  behaviour: {
    "ui:title": "Activity behaviour",
    showLiveResultsToStudents: f(
      "Show live counts to students after they vote",
      "Default on. Turn off for high-stakes polls where seeing others' answers would bias the response. The tally then only appears at reveal.",
    ),
    allowChangeVote: f(
      "Allow students to change their vote",
      "Default on. Each student's latest tap wins. Turn off to lock the first vote in.",
    ),
    showIndividualVotes: f(
      "Show individual votes to the instructor",
      "Default off (aggregate only). Enabling this lists each voter and their pick. Use only when the poll is openly attributed.",
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
} as const;

export default uiSchema;
