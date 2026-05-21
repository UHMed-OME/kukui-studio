/**
 * RJSF uiSchema for the branching-scenario activity. Drives Studio's form
 * editor — field order, labels, help text, widget choices. Hand-tuned;
 * cannot be auto-derived from Zod alone because RJSF needs designer
 * decisions about layout and copy.
 *
 * Extracted from apps/studio-app/src/uiSchemas.ts. The COMMON / TITLE /
 * AUTHOR / HIDDEN / BEHAVIOUR_RETRY / f() identifiers from that file are
 * inlined here as local constants so this module is standalone.
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

/**
 * Shared uiSchema for the `appearance` block (theme pin). Mirrors the
 * COMMON.APPEARANCE fragment from apps/studio-app/src/uiSchemas.ts so the
 * "Appearance" section renders identically here.
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

const TITLE = f(
  "Activity title",
  "Shown at the top of the activity and as the SCORM activity name.",
);

const AUTHOR = f(
  "Author (optional)",
  "Your name. Shown in the small credit line at the bottom of the activity.",
);

// After the Scoring tab landed, retry lives there. Kept as `HIDDEN` so the
// legacy schema field doesn't render in the Editor form — it's owned by
// the Scoring tab now.
const BEHAVIOUR_RETRY = HIDDEN;

const uiSchema = {
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
} as const;

export default uiSchema;
