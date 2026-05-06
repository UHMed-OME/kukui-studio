/**
 * RJSF uiSchemas, one per activity kind.
 *
 * The Zod schemas already give RJSF everything it needs to render *something*.
 * These uiSchemas reshape the form for authoring ergonomics:
 *   - Hide internals authors shouldn't touch (`version`, `_comment`).
 *   - Reorder fields so the meaty ones appear first.
 *   - Promote textarea + multiline rendering on long-form text fields.
 *   - Override subform titles with author-friendly labels.
 *   - Group `behaviour`/`ui` into clearly-titled sections.
 */
import type { ActivityKind } from "@kukui/core";

const HIDDEN = { "ui:widget": "hidden" } as const;

const COMMON = {
  version: HIDDEN,
  _comment: HIDDEN,
  $schema: HIDDEN,
} as const;

const BEHAVIOUR_TITLE = { "ui:title": "Activity behaviour" } as const;
const UI_TITLE = { "ui:title": "UI label overrides" } as const;

export const UI_SCHEMAS: Record<ActivityKind, Record<string, unknown>> = {
  "multiple-choice": {
    ...COMMON,
    "ui:order": ["title", "question", "answers", "behaviour", "ui", "overallFeedback", "*"],
    question: {
      "ui:widget": "textarea",
      "ui:options": { rows: 3 },
      "ui:description": "HTML allowed. Use <p>, <strong>, <em>, <sub>, <sup>.",
    },
    answers: {
      "ui:title": "Answer choices",
      items: {
        text: { "ui:title": "Choice text", "ui:options": { inputType: "text" } },
        feedback: {
          "ui:widget": "textarea",
          "ui:options": { rows: 2 },
          "ui:title": "Feedback shown after submit",
        },
        tip: {
          "ui:widget": "textarea",
          "ui:options": { rows: 2 },
          "ui:title": "Hint shown on hover before submit",
        },
      },
    },
    behaviour: BEHAVIOUR_TITLE,
    ui: UI_TITLE,
    overallFeedback: { "ui:title": "Score-band messages" },
  },

  "fill-in-the-blanks": {
    ...COMMON,
    "ui:order": ["title", "text", "behaviour", "ui", "*"],
    text: {
      "ui:widget": "textarea",
      "ui:options": { rows: 6 },
      "ui:description":
        "Wrap each blank in asterisks. Alternates with / or |. Example: Photosynthesis takes in *carbon dioxide/CO2* and releases *oxygen/O2*.",
    },
    behaviour: BEHAVIOUR_TITLE,
    ui: UI_TITLE,
  },

  "drag-and-drop": {
    ...COMMON,
    "ui:order": ["title", "background", "draggables", "dropZones", "behaviour", "ui", "*"],
    background: {
      "ui:title": "Background image",
      src: { "ui:title": "Image URL", "ui:options": { inputType: "url" } },
      alt: { "ui:title": "Alt text (for screen readers)" },
    },
    draggables: { "ui:title": "Draggable labels" },
    dropZones: { "ui:title": "Drop zones" },
    behaviour: BEHAVIOUR_TITLE,
    ui: UI_TITLE,
  },

  "course-presentation": {
    ...COMMON,
    "ui:order": ["title", "slides", "passPercentage", "behaviour", "ui", "*"],
    slides: { "ui:title": "Slides" },
    passPercentage: {
      "ui:title": "Pass threshold (%)",
      "ui:description": "Default 70. Score-as-percent must reach this to count as passed.",
    },
    behaviour: BEHAVIOUR_TITLE,
    ui: UI_TITLE,
  },

  "question-set": {
    ...COMMON,
    "ui:order": ["title", "questions", "passPercentage", "behaviour", "ui", "*"],
    questions: { "ui:title": "Questions in this set" },
    passPercentage: {
      "ui:title": "Pass threshold (%)",
      "ui:description": "Default 50. Score-as-percent must reach this to count as passed.",
    },
    behaviour: BEHAVIOUR_TITLE,
    ui: UI_TITLE,
  },

  "hotspot-3d": {
    ...COMMON,
    "ui:order": ["title", "prompt", "model", "camera", "hotspots", "behaviour", "ui", "*"],
    prompt: {
      "ui:widget": "textarea",
      "ui:options": { rows: 3 },
      "ui:description": "HTML allowed. Use <p>, <em>, <strong>.",
    },
    model: {
      "ui:title": "3D model",
      src: { "ui:title": "Model URL (.glb / .gltf)", "ui:options": { inputType: "url" } },
      scale: { "ui:title": "Uniform scale" },
    },
    camera: { "ui:title": "Camera setup" },
    hotspots: { "ui:title": "Clickable hotspots" },
    behaviour: BEHAVIOUR_TITLE,
    ui: UI_TITLE,
  },

  "virtual-tour": {
    ...COMMON,
    "ui:order": ["title", "scene", "movement", "overlays", "completion", "behaviour", "ui", "*"],
    scene: {
      "ui:title": "Scene",
      src: { "ui:title": "Scene URL (.glb / .gltf)", "ui:options": { inputType: "url" } },
      spawn: { "ui:title": "Spawn position" },
    },
    movement: { "ui:title": "Movement controls" },
    overlays: { "ui:title": "Points of interest" },
    completion: { "ui:title": "Completion mode" },
    behaviour: BEHAVIOUR_TITLE,
    ui: UI_TITLE,
  },
};
