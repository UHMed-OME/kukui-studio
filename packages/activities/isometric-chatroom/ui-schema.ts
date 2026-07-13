/** RJSF uiSchema for the isometric-chatroom activity. Extracted from apps/studio-app/src/uiSchemas.ts. */

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
  "ui:order": ["title", "prompt", "room", "characters", "rules", "emoji", "live", "appearance", "*"],
  title: TITLE,
  author: AUTHOR,
  prompt: f(
    "Lobby prompt (optional)",
    "Shown to students in the lobby before the instructor starts the activity.",
    { "ui:widget": "textarea", "ui:options": { rows: 3 } },
  ),
  room: {
    "ui:title": "Room",
    "ui:help": "Configure the isometric room appearance and size.",
    name: f("Room name", "Displayed in the room header."),
    theme: f(
      "Room theme",
      "Preset environment. Each theme has its own floor, walls, and furniture.",
      { "ui:enumNames": ["Classroom", "Library", "Cafe", "Lounge", "Outdoor", "Custom"] },
    ),
    backgroundImage: f(
      "Custom background image",
      "Paste a URL or upload a file. Overrides the theme background.",
      {
        "ui:widget": "file",
        "ui:options": { accept: "image/*", maxSizeMb: 5, kind: "image" },
      },
    ),
    backgroundAlt: f(
      "Background alt text (required if image set)",
      "Describes the custom background for screen-reader users.",
    ),
    width: f("Room width (tiles)", "8-20 tiles. Wider rooms give more walking space.", {
      "ui:options": { step: 1, min: 8, max: 20 },
    }),
    height: f("Room height (tiles)", "8-20 tiles.", {
      "ui:options": { step: 1, min: 8, max: 20 },
    }),
    seed: f(
      "Seed",
      "Deterministic room layout. Use 'reshuffle' to regenerate.",
    ),
  },
  characters: {
    "ui:title": "Characters",
    "ui:help": "Available avatar options. Students pick one in the lobby. Drag to reorder.",
    "ui:options": {
      order: ["id", "label", "sprite", "palette", "availableToStudents"],
    },
    items: {
      id: HIDDEN,
      label: f("Display name", "What the learner sees in the character picker."),
      sprite: f(
        "Sprite",
        "Base64 data URL or external URL. 16×24 pixel art.",
        {
          "ui:widget": "file",
          "ui:options": { accept: "image/*", maxSizeMb: 1, kind: "image" },
        },
      ),
      palette: f(
        "Palette override (optional)",
        "Array of 8 hex colors. Overrides the default palette for this character.",
      ),
      availableToStudents: f(
        "Available to students",
        "When off, only the instructor can use this character.",
      ),
    },
  },
  rules: {
    "ui:title": "Chat rules",
    "ui:help": "Configure chat behavior and constraints.",
    "ui:order": [
      "requireAcknowledge",
      "rules",
      "maxMessageLength",
      "messageDisplayDuration",
      "chatMode",
      "allowLobbyClose",
      "allowIndividualMute",
      "allowMessageDeletion",
      "showNamesInChat",
    ],
    requireAcknowledge: f(
      "Require rule acknowledgment",
      "Students must see the rules before entering the room.",
    ),
    rules: {
      "ui:title": "Room rules",
      "ui:help": "Displayed in the lobby. Min 1, max 10 rules.",
      items: {
        "ui:title": "Rule",
      },
    },
    maxMessageLength: f(
      "Max message length",
      "Characters. Default 280. Min 50. Max 1000.",
      { "ui:options": { step: 10, min: 50, max: 1000 } },
    ),
    messageDisplayDuration: f(
      "Message display duration",
      "How long speech bubbles stay above avatars. Default 8000ms. Min 3000. Max 30000.",
      { "ui:options": { step: 500, min: 3000, max: 30000 } },
    ),
    chatMode: f(
      "Chat mode",
      "When students can type. 'Free' = always. 'Question' = only during question phase. 'Discussion' = only during discussion phase.",
      { "ui:enumNames": ["Free (always)", "Question phase only", "Discussion phase only"] },
    ),
    allowLobbyClose: f("Allow instructor to close lobby", ""),
    allowIndividualMute: f("Allow individual mute", ""),
    allowMessageDeletion: f("Allow message deletion", ""),
    showNamesInChat: f("Show names in chat", ""),
  },
  emoji: {
    "ui:title": "Emoji reactions",
    "ui:help": "Emoji set available for student reactions.",
    "ui:order": ["preset", "custom"],
    preset: f(
      "Emoji preset",
      "Choose a curated set or define your own.",
      { "ui:enumNames": ["Standard (24)", "Academic (20)", "Minimal (12)", "Custom"] },
    ),
    custom: {
      "ui:title": "Custom emoji set",
      "ui:help": "Only used when preset is 'Custom'. Min 4, max 24 entries.",
      items: {
        name: f("Name", "Display name for this emoji."),
        char: f("Emoji character", "The emoji character (1-4 code units)."),
      },
    },
  },
  live: LIVE_SETTINGS_UI,
  appearance: HIDDEN,
} as const;

export default uiSchema;
