/**
 * RJSF uiSchema for the clinical-case activity. Drives Studio's form editor —
 * field order, labels, help text. A generated starting point; hand-tune the
 * per-field copy and widget choices as a follow-up.
 *
 * COMMON / APPEARANCE / TITLE / AUTHOR / f() mirror the conventions in the
 * sibling activities' ui-schema modules so the shared sections render
 * identically. Kept standalone (no cross-import) on purpose.
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
    "How the activity looks on the learner's screen. \"Auto\" lets the OS decide; pick a specific scheme to override the learner's preference.",
  ),
} as const;

const COMMON = {
  version: HIDDEN,
  _comment: HIDDEN,
  $schema: HIDDEN,
  appearance: APPEARANCE,
} as const;

const TITLE = f(
  "Case title",
  "Shown at the top of the activity and as the SCORM activity name.",
);

const AUTHOR = f("Author (optional)", "Your name. Shown in a small credit line.");

const uiSchema = {
  ...COMMON,
  "ui:order": [
    "title",
    "author",
    "course",
    "school",
    "week",
    "presentation",
    "anatomy",
    "diagnosis",
    "quiz",
    "activity",
    "*",
  ],
  title: TITLE,
  author: AUTHOR,
  course: f("Course (optional)", "Course code or name shown in the case header."),
  school: f("School (optional)"),
  week: f("Module label (optional)", "e.g. \"Week 1\"."),
  presentation: {
    "ui:title": "1. Patient presentation",
    "ui:help": "Chief complaint, vitals, exam findings, labs, and a reflection cue.",
    label: f("Section badge", "Short label, e.g. \"Clinical Presentation\"."),
    title: f("Section title"),
    lead: f("Intro", "Optional HTML shown under the section title."),
    chiefComplaint: f("Chief complaint", "HTML — the history of present illness."),
    vitals: {
      "ui:title": "Vital signs",
      items: {
        value: f("Value", "e.g. \"144/67\"."),
        label: f("Label", "e.g. \"BP (mmHg)\"."),
        flag: f("Flag", "normal, watch (borderline), or alert."),
        flagText: f("Flag text", "Short word shown beside the value, e.g. \"Elevated\"."),
      },
    },
    examFindings: {
      "ui:title": "Exam findings",
      items: {
        type: f("Type", "present, absent (pertinent negative), or neutral."),
        text: f("Finding", "HTML."),
      },
    },
    labResults: { "ui:title": "Lab results", items: { text: f("Lab row", "HTML.") } },
    reflectionPrompt: f("Reflection cue", "HTML shown in the callout box."),
  },
  anatomy: {
    "ui:title": "2. Anatomy & imaging",
    label: f("Section badge"),
    title: f("Section title"),
    lead: f("Intro"),
    imagingFinding: f("Imaging finding", "HTML."),
    diagram: {
      "ui:title": "Diagram (optional image)",
      "ui:help": "A hosted image URL. Inline SVG is not supported.",
      src: f("Image URL"),
      alt: f("Alt text", "Required description of the diagram for screen readers."),
      caption: f("Caption"),
    },
    diagramLegend: { "ui:title": "Diagram legend", items: { label: f("Legend entry") } },
    spaces: {
      "ui:title": "Anatomical spaces",
      items: { name: f("Space name"), detail: f("Detail", "HTML.") },
    },
    notes: {
      "ui:title": "Anatomy notes",
      items: { highlight: f("Highlight this note"), text: f("Note", "HTML.") },
    },
  },
  diagnosis: {
    "ui:title": "3. Diagnosis & management",
    label: f("Section badge"),
    title: f("Section title"),
    lead: f("Intro"),
    keyFinding: f("Key finding", "HTML — the pathognomonic finding."),
    differential: {
      "ui:title": "Differential diagnosis",
      items: {
        verdict: f("Verdict", "in = confirmed/ruled-in, out = excluded."),
        text: f("Item", "HTML."),
      },
    },
    causes: { "ui:title": "Aetiology tags" },
    management: {
      "ui:title": "Management steps",
      items: { urgent: f("Urgent / priority"), text: f("Step", "HTML.") },
    },
    references: { "ui:title": "References" },
  },
  quiz: {
    "ui:title": "4. Formative quiz",
    "ui:help": "Multiple-choice questions with immediate per-option feedback.",
    label: f("Section badge"),
    title: f("Section title"),
    lead: f("Intro"),
    questions: {
      "ui:title": "Questions",
      items: {
        id: HIDDEN,
        question: f("Question stem"),
        options: { "ui:title": "Options", "ui:help": "Two or more answer options, in order." },
        correctIndex: f("Correct option index", "0 = first option, 1 = second, …"),
        feedbackPerOption: {
          "ui:title": "Per-option feedback",
          "ui:help": "One explanation per option, in the same order. The best teaching moment.",
        },
      },
    },
    scoreMessages: {
      "ui:title": "Score messages",
      "ui:help": "Optional. One message per number-correct, from 0 to the question count.",
    },
  },
  activity: {
    "ui:title": "5. Activity / assignment",
    label: f("Section badge"),
    title: f("Section title"),
    lead: f("Intro"),
    objectives: {
      "ui:title": "Learning objectives",
      items: { text: f("Objective"), hint: f("Hint") },
    },
    submissionPlatform: f("Submission platform", "e.g. \"Brightspace → Assignments\"."),
    formats: {
      "ui:title": "Format options",
      items: {
        id: HIDDEN,
        icon: f("Icon", "Optional emoji."),
        name: f("Format name"),
        desc: f("Short description"),
        guidance: f("Guidance", "HTML — detailed instructions."),
        submission: f("Submission instructions", "HTML."),
      },
    },
  },
} as const;

export default uiSchema;
