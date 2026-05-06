/**
 * Catalog of planned activity kinds — listed in Studio so authors see
 * what's coming, even before each implementation lands.
 *
 * These map to the StubConfigSchema and render via StubActivity until
 * a real schema + component replace them. Adding a new entry here makes
 * it appear in Studio's "Coming soon" group and (once linked into the
 * SchemaRegistry + ActivityHost dispatch) won't break validation.
 */
export const PLANNED_ACTIVITY_KINDS = [
  "sequence-steps",
  "matching-pairs",
  "categorization",
  "concept-map",
  "image-annotation",
  "image-comparison-slider",
  "anatomy-labeling",
  "branching-scenario",
  "interactive-video",
  "audio-recording",
  "highlight-text",
  "lab-panel",
  "ddx-tree",
  "osce",
  "flashcards",
  "reflection-prompt",
] as const;

export type PlannedActivityKind = (typeof PLANNED_ACTIVITY_KINDS)[number];

export const PLANNED_LABELS: Record<PlannedActivityKind, string> = {
  "sequence-steps": "Sequence / Order Steps",
  "matching-pairs": "Matching Pairs",
  categorization: "Categorization",
  "concept-map": "Concept Map",
  "image-annotation": "Image Annotation / Draw",
  "image-comparison-slider": "Image Comparison Slider",
  "anatomy-labeling": "Anatomy Labeling",
  "branching-scenario": "Branching Scenario",
  "interactive-video": "Interactive Video",
  "audio-recording": "Audio Recording / Pronunciation",
  "highlight-text": "Highlight Text Spans",
  "lab-panel": "Lab Panel Interpretation",
  "ddx-tree": "Differential Diagnosis Tree",
  osce: "OSCE Clinical Encounter",
  flashcards: "Flashcards / Recall Drill",
  "reflection-prompt": "Reflection Prompt",
};

export const PLANNED_DESCRIPTIONS: Record<PlannedActivityKind, string> = {
  "sequence-steps": "Drag a list of items into the correct order. Pathways, procedures, timelines.",
  "matching-pairs":
    "Drag a line between paired items in two columns — terms ↔ definitions, drugs ↔ classes, etc.",
  categorization: "Drag items into the right category bin.",
  "concept-map":
    "Build a node-link diagram of relationships. Real-time multi-learner version coming in Live.",
  "image-annotation":
    "Free-draw shapes on a 2D image. Radiology, pathology, marking up samples.",
  "image-comparison-slider": "Two images with a draggable seam between them. Before/after.",
  "anatomy-labeling": "Drag named labels onto an anatomical illustration.",
  "branching-scenario":
    "Decision tree where each choice routes to a different next node. Parent of DDx Tree + OSCE.",
  "interactive-video":
    "Inline questions over a YouTube / Vimeo / hosted MP4 timeline. Pauses to ask.",
  "audio-recording":
    "Learner records audio (pronunciation, summary). Streams to peers in Live; uploaded artifact in async.",
  "highlight-text":
    "Select spans in a text passage. Close-reading, paths-of-disease, evidence-marking.",
  "lab-panel":
    "Annotate a lab-panel result image. First med-ed-specific composite.",
  "ddx-tree":
    "Specialization of Branching Scenario — case unfolds, learner narrows differential.",
  osce: "Specialization of Branching Scenario — flagship clinical encounter.",
  flashcards: "Recall drill with self-assessment. Optional spaced-repetition.",
  "reflection-prompt":
    "Free-text reflection. Completion-only, no auto-grade.",
};
