/**
 * Minimal valid config used as Studio's "new activity" template.
 */
const starter = {
  version: "1.0",
  title: "Clinical Anatomy Case",
  week: "Week 1",
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
};

export default starter;
