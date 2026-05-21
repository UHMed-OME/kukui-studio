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
import { ACTIVITY_MANIFESTS } from "@kukui/activities";

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

const LEGACY_UI_SCHEMAS: Partial<Record<ActivityKind, Record<string, unknown>>> = {
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

  "isometric-chatroom": {
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
      width: f("Room width (tiles)", "8–20 tiles. Wider rooms give more walking space.", {
        "ui:options": { step: 1, min: 8, max: 20 },
      }),
      height: f("Room height (tiles)", "8–20 tiles.", {
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
          char: f("Emoji character", "The emoji character (1–4 code units)."),
        },
      },
    },
    live: LIVE_SETTINGS_UI,
    appearance: HIDDEN,
  },

  // Multiple-choice intentionally absent — it now ships from
  // @kukui/activities/multiple-choice/manifest.ts and is merged in via
  // MANIFEST_UI_SCHEMAS below.
};

// Minimal stub uiSchema for every planned kind. PLANNED_ACTIVITY_KINDS is
// currently empty (every spec'd activity has shipped) — this map is a future
// hook for when the catalog grows again.
const PLANNED_STUBS: Partial<Record<ActivityKind, Record<string, unknown>>> = {};
for (const kind of PLANNED_ACTIVITY_KINDS) {
  (PLANNED_STUBS as Record<string, unknown>)[kind] = {
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

// uiSchemas sourced from per-activity manifests in @kukui/activities. As
// Plan 2's bulk migration drains LEGACY_UI_SCHEMAS entry by entry, more
// kinds will appear here automatically.
const MANIFEST_UI_SCHEMAS: Partial<Record<ActivityKind, Record<string, unknown>>> =
  Object.fromEntries(
    Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.uiSchema as Record<string, unknown>]),
  );

/**
 * Final merged uiSchema map exposed to Studio. Manifest entries win over
 * legacy hand-tuned entries, which win over planned stubs. The cast at the
 * end acknowledges TypeScript can't statically prove every ActivityKind is
 * covered after the merge — runtime coverage is enforced by the test suite
 * + Studio's stub-fallback render path (see Preview.tsx StubActivityLazy).
 */
export const UI_SCHEMAS: Record<ActivityKind, Record<string, unknown>> = {
  ...PLANNED_STUBS,
  ...LEGACY_UI_SCHEMAS,
  ...MANIFEST_UI_SCHEMAS,
} as Record<ActivityKind, Record<string, unknown>>;
