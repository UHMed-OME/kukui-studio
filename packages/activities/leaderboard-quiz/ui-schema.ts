/**
 * RJSF uiSchema for the leaderboard-quiz activity. Generated starting point:
 * hand-tune labels, help text, and widgets (e.g. a tag input for
 * acceptedAnswers, a topic dropdown for topicId) as a follow-up.
 */

/** Compact builder: f(label, help, opts?) → uiSchema fragment for a leaf field. */
function f(title: string, help?: string, extra: Record<string, unknown> = {}) {
  return {
    "ui:title": title,
    ...(help ? { "ui:help": help } : {}),
    ...extra,
  };
}

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
  "ui:order": ["title", "author", "topics", "questions", "round", "pointsPerCorrect", "strings", "live", "*"],
  title: f("Activity title", "Shown at the top of the activity and as the SCORM activity name."),
  author: f("Author (optional)", "Shown in the small credit line at the bottom of the activity."),
  topics: {
    "ui:title": "Topics",
    items: {
      id: f("Topic id", "Lowercase kebab-case, e.g. cardiovascular. Questions point at this."),
      label: f("Topic name", "What learners see on the topic chip."),
    },
  },
  questions: {
    "ui:title": "Questions",
    items: {
      "ui:options": { foldFields: { title: "Feedback (optional)", fields: ["feedbackCorrect", "feedbackIncorrect"] } },
      id: { "ui:widget": "hidden" },
      topicId: f("Topic", "Pick from the topics you added above.", { "ui:widget": "topicSelect" }),
      prompt: f(
        "Prompt",
        "What the learner is asked, e.g. the medical term for a heart attack. For a fill-in-the-blank, type three underscores (___) where the answer goes, e.g. The ___ pumps blood to the body.",
      ),
      image: {
        "ui:title": "Image (optional)",
        "ui:options": { foldable: true },
        src: f("Image", "Paste a link or upload a file. Uploaded files are saved inside the activity.", {
          "ui:widget": "file",
          "ui:options": { accept: "image/*", maxSizeMb: 5, kind: "image", maxDimension: 800 },
        }),
        alt: f(
          "Alt text (required)",
          "Describes the image for screen-reader users.",
        ),
        attribution: {
          "ui:title": "Image credit (optional)",
          "ui:options": { foldable: true, compact: true },
          "ui:help": "Shows as a small credit line at the bottom while this question is on screen.",
          author: f("Author", "Name of the photographer or source."),
          authorUrl: f("Author URL", "Optional link to the author's page."),
          sourceUrl: f("Source URL", "Optional link to the original image page."),
          license: f("License", "Short license name, for example \"CC0\" or \"CC BY 4.0\"."),
          licenseUrl: f("License URL", "Optional link to the license text."),
        },
      },
      acceptedAnswers: { "ui:widget": "hidden" },
      blanks: {
        "ui:title": "Answers",
        "ui:options": { addLabel: "Add another blank", blankCountFrom: "prompt" },
        "ui:help":
          "One answer for a normal question. For fill-in-the-blank, type ___ in the prompt for each blank and add one answer here per blank, in order. The question is correct only if every blank is right.",
        items: {
          acceptedAnswers: f(
            "Accepted answers",
            "Everything that counts as correct for this answer. Add synonyms and abbreviations; matching ignores case and punctuation.",
          ),
        },
      },
      feedbackCorrect: f("Feedback when correct", "Reinforce why the answer fits."),
      feedbackIncorrect: f("Feedback when incorrect", "Redirect the learner."),
    },
  },
  round: {
    "ui:title": "Round settings",
    questionCount: f("Questions per round"),
    shuffle: f("Shuffle questions"),
    topicSelection: f(
      "Topic menu",
      "learner-picks lets learners choose which topics to practice; all-topics always uses every topic.",
    ),
    timeLimitSeconds: f("Time limit (seconds)", "One countdown for the whole round. Leave empty for no limit."),
  },
  pointsPerCorrect: f("Points per correct answer"),
  strings: f(
    "Custom text (optional)",
    "Override built-in wording. Keys: start, submit, next, noTimeLimit, timesUp, savedNotice, clearRecord, playAgain, questionOf, points, correct, incorrect, answerLabel, secondsLeft, bestLine, noRecord, attempt, attempts.",
  ),
  live: LIVE_SETTINGS_UI,
} as const;

export default uiSchema;
