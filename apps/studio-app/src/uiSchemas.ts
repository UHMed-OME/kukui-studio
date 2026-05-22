/**
 * RJSF uiSchemas, one per activity kind.
 *
 * Every meaningful field gets a human-readable `ui:title` + a one-line
 * `ui:help` explanation. Help text becomes a hover-tooltip via the custom
 * FieldTemplate in templates/FieldTemplate.tsx; description text (where
 * present) renders inline below the label for fields that need format
 * guidance the author has to see at a glance.
 *
 * Each per-activity uiSchema lives alongside its manifest in
 * `packages/activities/{slug}/ui-schema.ts` and inlines the small set of
 * helper fragments it needs. This file is now a thin aggregator: it
 * stubs out any `PLANNED_ACTIVITY_KINDS` (so Studio's catalog renders a
 * placeholder form for not-yet-shipped activities) and merges them with
 * the manifest-sourced uiSchemas.
 */
import { type ActivityKind, PLANNED_ACTIVITY_KINDS } from "@kukui/core";
import { ACTIVITY_MANIFESTS } from "@kukui/activities";

// Minimal stub uiSchema for every planned kind. PLANNED_ACTIVITY_KINDS is
// currently empty (every spec'd activity has shipped) — this map is a future
// hook for when the catalog grows again.
const PLANNED_STUB_BODY = {
  version: { "ui:widget": "hidden" },
  _comment: { "ui:widget": "hidden" },
  $schema: { "ui:widget": "hidden" },
  appearance: {
    "ui:title": "Appearance",
    "ui:help":
      "Pin a color scheme for this activity. \"Auto\" follows the learner's OS preference.",
    theme: {
      "ui:title": "Color scheme",
      "ui:help":
        "How the activity looks on the learner's screen. \"Auto\" lets the OS decide (light/dark); pick a specific scheme to override regardless of the learner's preference.",
    },
  },
  title: {
    "ui:title": "Activity title",
    "ui:help": "What learners and instructors see in the gradebook.",
  },
  description: {
    "ui:title": "Description",
    "ui:help": "Short summary of what the activity will do.",
    "ui:widget": "textarea",
    "ui:options": { rows: 2 },
  },
  notes: {
    "ui:title": "Author notes",
    "ui:help": "Use this space to draft requirements or design ideas.",
    "ui:widget": "textarea",
    "ui:options": { rows: 6 },
  },
} as const;

const PLANNED_STUBS: Partial<Record<ActivityKind, Record<string, unknown>>> =
  Object.fromEntries(PLANNED_ACTIVITY_KINDS.map((kind) => [kind, PLANNED_STUB_BODY]));

// uiSchemas sourced from per-activity manifests in @kukui/activities.
const MANIFEST_UI_SCHEMAS: Partial<Record<ActivityKind, Record<string, unknown>>> =
  Object.fromEntries(
    Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.uiSchema as Record<string, unknown>]),
  );

/**
 * Final merged uiSchema map exposed to Studio. Manifest entries win over
 * planned stubs. The cast at the end acknowledges TypeScript can't statically
 * prove every ActivityKind is covered after the merge — runtime coverage is
 * enforced by the test suite + Studio's stub-fallback render path (see
 * Preview.tsx StubActivityLazy).
 */
export const UI_SCHEMAS: Record<ActivityKind, Record<string, unknown>> = {
  ...PLANNED_STUBS,
  ...MANIFEST_UI_SCHEMAS,
} as Record<ActivityKind, Record<string, unknown>>;
