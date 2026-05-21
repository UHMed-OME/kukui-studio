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
