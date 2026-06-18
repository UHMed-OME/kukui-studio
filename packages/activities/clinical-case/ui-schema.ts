/**
 * RJSF uiSchema for the clinical-case activity. Drives Studio's form editor —
 * field order, labels, help text, widget choices. Prose/HTML fields use the
 * shared Tiptap WYSIWYG widget (`ui:widget: "html"`) so authors format with a
 * toolbar instead of typing tags.
 *
 * COMMON / APPEARANCE / TITLE / AUTHOR / f() mirror the conventions in the
 * sibling activities' ui-schema modules. Kept standalone (no cross-import).
 */

const HIDDEN = { "ui:widget": "hidden" } as const;
const HTML = { "ui:widget": "html" } as const;

/** Leaf field: f(label, help, opts?). */
function f(title: string, help?: string, extra: Record<string, unknown> = {}) {
  return {
    "ui:title": title,
    ...(help ? { "ui:help": help } : {}),
    ...extra,
  };
}

/** Rich-text (WYSIWYG) leaf field. */
function fh(title: string, help?: string) {
  return f(title, help, HTML);
}

const APPEARANCE = {
  "ui:title": "Appearance",
  "ui:help":
    "Pin a color scheme for this activity. \"Auto\" follows the learner's OS preference.",
  theme: f(
    "Color scheme",
    "How the activity looks on the learner's screen. \"Auto\" lets the OS decide; pick a specific scheme to override the learner's preference.",
  ),
  header: f(
    "Header style",
    "Full = gradient banner with the kukui mark; Minimal = a plain title block.",
  ),
} as const;

const COMMON = {
  version: HIDDEN,
  _comment: HIDDEN,
  $schema: HIDDEN,
  appearance: APPEARANCE,
} as const;

const TITLE = f("Case title", "Shown in the banner and as the SCORM activity name.");
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
  course: f("Course (optional)", "Course code or name shown in the banner."),
  school: f("School (optional)"),
  week: f("Module label (optional)", "e.g. \"Week 1\"."),
  presentation: {
    "ui:title": "1. Patient presentation",
    "ui:help": "Chief complaint, vitals, exam findings, labs, and a reflection cue.",
    label: f("Section badge", "Short label, e.g. \"Clinical Presentation\"."),
    title: f("Section title"),
    lead: fh("Intro", "Shown under the section title."),
    chiefComplaint: fh("Chief complaint", "The history of present illness."),
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
        text: fh("Finding"),
      },
    },
    labResults: { "ui:title": "Lab results", items: { text: fh("Lab row") } },
    reflectionPrompt: fh("Reflection cue", "Shown in the callout box."),
  },
  anatomy: {
    "ui:title": "2. Anatomy & imaging",
    label: f("Section badge"),
    title: f("Section title"),
    lead: fh("Intro"),
    imagingFinding: fh("Imaging finding"),
    diagram: {
      "ui:title": "Diagram (optional)",
      "ui:help": "Upload (or paste) an image OR an inline SVG. Use one or the other.",
      src: f("Image (upload or URL)", "Upload an image file or paste a hosted URL. Leave blank if using SVG.", {
        "ui:widget": "file",
        "ui:options": { kind: "image", accept: "image/png,image/jpeg,image/gif,image/webp", maxSizeMb: 2 },
      }),
      svg: f("Inline SVG (upload or paste)", "Upload an .svg file or paste markup. Sanitized at render (scripts removed).", {
        "ui:widget": "svgUpload",
        "ui:options": { rows: 8, maxSizeMb: 1 },
      }),
      alt: f("Alt text", "Required description of the diagram for screen readers."),
      caption: f("Caption"),
    },
    diagramLegend: {
      "ui:title": "Diagram legend",
      items: {
        label: f("Legend entry"),
        tone: f("Swatch color", "Maps the swatch to a design token."),
      },
    },
    spaces: {
      "ui:title": "Anatomical spaces",
      items: { name: f("Space name"), detail: fh("Detail") },
    },
    notes: {
      "ui:title": "Anatomy notes",
      items: { highlight: f("Highlight this note"), text: fh("Note") },
    },
  },
  diagnosis: {
    "ui:title": "3. Diagnosis & management",
    label: f("Section badge"),
    title: f("Section title"),
    lead: fh("Intro"),
    keyFinding: fh("Key finding", "The pathognomonic finding."),
    differential: {
      "ui:title": "Differential diagnosis",
      items: {
        verdict: f("Verdict", "in = confirmed/ruled-in, out = excluded."),
        text: fh("Item"),
      },
    },
    causes: { "ui:title": "Aetiology tags" },
    management: {
      "ui:title": "Management steps",
      items: { urgent: f("Urgent / priority"), text: fh("Step") },
    },
    references: { "ui:title": "References", items: fh("Reference") },
  },
  quiz: {
    "ui:title": "4. Formative quiz",
    "ui:help": "Multiple-choice questions with immediate per-option feedback.",
    label: f("Section badge"),
    title: f("Section title"),
    lead: fh("Intro"),
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
    lead: fh("Intro"),
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
        guidance: fh("Guidance", "Detailed instructions."),
        submission: fh("Submission instructions"),
      },
    },
  },
} as const;

export default uiSchema;
