/**
 * Catalog of planned activity kinds — listed in Studio so authors see
 * what's coming, even before each implementation lands.
 *
 * These map to the StubConfigSchema and render via StubActivity until
 * a real schema + component replace them. Once a kind ships, remove it
 * from this list and wire its real schema in @kukui/schemas + dispatch
 * in activity-host.tsx.
 */
export const PLANNED_ACTIVITY_KINDS = [
  "concept-map",
  "image-annotation",
  "branching-scenario",
  "interactive-video",
  "audio-recording",
  "lab-panel",
  "ddx-tree",
  "osce",
] as const;

export type PlannedActivityKind = (typeof PLANNED_ACTIVITY_KINDS)[number];

export const PLANNED_LABELS: Record<PlannedActivityKind, string> = {
  "concept-map": "Concept Map",
  "image-annotation": "Image Annotation / Draw",
  "branching-scenario": "Branching Scenario",
  "interactive-video": "Interactive Video",
  "audio-recording": "Audio Recording / Pronunciation",
  "lab-panel": "Lab Panel Interpretation",
  "ddx-tree": "Differential Diagnosis Tree",
  osce: "OSCE Clinical Encounter",
};

export const PLANNED_DESCRIPTIONS: Record<PlannedActivityKind, string> = {
  "concept-map":
    "Build a node-link diagram of relationships. Real-time multi-learner version coming in Live.",
  "image-annotation":
    "Free-draw shapes on a 2D image. Radiology, pathology, marking up samples.",
  "branching-scenario":
    "Decision tree where each choice routes to a different next node. Parent of DDx Tree + OSCE.",
  "interactive-video":
    "Inline questions over a YouTube / Vimeo / hosted MP4 timeline. Pauses to ask.",
  "audio-recording":
    "Learner records audio (pronunciation, summary). Streams to peers in Live; uploaded artifact in async.",
  "lab-panel":
    "Annotate a lab-panel result image. First med-ed-specific composite.",
  "ddx-tree":
    "Specialization of Branching Scenario — case unfolds, learner narrows differential.",
  osce: "Specialization of Branching Scenario — flagship clinical encounter.",
};
