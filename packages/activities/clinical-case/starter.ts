/**
 * Minimal valid config used as Studio's "new activity" template.
 */
const starter = {
  version: "1.0",
  title: "Clinical Case",
  week: "Week 1",
  // Grade the formative quiz by default (points + 60% pass) rather than the
  // silent "completion = always pass" fallback. Authors can change this in the
  // Scoring tab.
  scoring: { mode: "points", passPercentage: 60, enableRetry: true },
  presentation: {
    label: "Clinical Presentation",
    title: "Patient presentation",
    chiefComplaint: "<p>Describe the chief complaint and history of present illness.</p>",
    vitals: [{ value: "120/80", label: "BP (mmHg)", flag: "normal", flagText: "Normal" }],
    examFindings: [{ type: "present", text: "<strong>Finding:</strong> describe the key exam finding." }],
    reflectionPrompt: "💡 <strong>Stop and think:</strong> what is your working diagnosis?",
  },
  anatomy: {
    label: "Anatomy",
    title: "Relevant anatomy",
    imagingFinding: "<p>Describe the key imaging finding.</p>",
  },
  diagnosis: {
    label: "Diagnosis",
    title: "Diagnosis & management",
    keyFinding: "<p>Describe the pathognomonic finding.</p>",
  },
  quiz: {
    title: "Check your understanding",
    questions: [
      {
        id: "q1",
        question: "Which structure best explains the presentation?",
        options: ["A. First option", "B. Second option"],
        correctIndex: 0,
        feedbackPerOption: [
          "Correct — explain why this is right.",
          "Not quite — redirect the learner here.",
        ],
      },
    ],
  },
  // Seeded with one complete format so Studio's RJSF form loads clean.
  // `activity` is optional, but the editor's default-fill materializes it
  // and pads `formats` to its min(1) with an empty item — whose required
  // id/name/guidance then fail validation on load. Shipping a complete
  // example item avoids that and gives authors a template to edit.
  activity: {
    label: "Activity",
    title: "Choose your format",
    objectives: [{ text: "Describe an objective the learner must meet." }],
    submissionPlatform: "Brightspace → Assignments",
    formats: [
      {
        id: "written",
        icon: "📄",
        name: "Written analysis",
        desc: "A short written response",
        guidance: "<p>Write 400–600 words addressing each objective.</p>",
        submission: "<p>Upload a PDF to the assignment.</p>",
      },
    ],
  },
  // Seeded so Studio's RJSF form loads clean: z.toJSONSchema marks a
  // .default() field as `required`, so AJV flags a missing `appearance`
  // on load even though Zod fills the default. (Same pattern as
  // isometric-chatroom's starter.)
  appearance: { theme: "auto" },
};

export default starter;
