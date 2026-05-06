/**
 * Minimal valid config per activity kind, used as the initial form value
 * when an author creates a new activity (or hits Reset).
 */
import type { ActivityKind } from "@kukui/core";

export const STARTERS: Record<ActivityKind, unknown> = {
  "multiple-choice": {
    version: "1.0",
    title: "Untitled multiple choice",
    question: "<p>Replace this with your question.</p>",
    answers: [
      { text: "Option A", correct: true },
      { text: "Option B", correct: false },
    ],
    behaviour: { enableRetry: true, enableSolutionsButton: false, singlePoint: false },
  },
  "fill-in-the-blanks": {
    version: "1.0",
    title: "Untitled fill in the blanks",
    text: "Photosynthesis takes in *carbon dioxide* and releases *oxygen*.",
    behaviour: { enableRetry: true, caseSensitive: false },
  },
  "drag-and-drop": {
    version: "1.0",
    title: "Untitled drag and drop",
    background: {
      src: "https://placehold.co/1024x640/e8f5e9/2e6e41?text=Background+image",
    },
    draggables: [{ id: "d1", label: "Label A", correctZones: ["z1"] }],
    dropZones: [{ id: "z1", label: "Zone 1", rect: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 } }],
    behaviour: { enableRetry: true },
  },
  "course-presentation": {
    version: "1.0",
    title: "Untitled presentation",
    slides: [
      {
        elements: [
          {
            type: "text",
            html: "<h1>Welcome</h1><p>Your first slide.</p>",
            rect: { x: 0.1, y: 0.2, w: 0.8, h: 0.5 },
          },
        ],
      },
    ],
    behaviour: { showProgressBar: true, enableRetry: true },
  },
  "question-set": {
    version: "1.0",
    title: "Untitled question set",
    questions: [
      {
        type: "multipleChoice",
        config: {
          version: "1.0",
          title: "Question 1",
          question: "<p>What's the answer?</p>",
          answers: [
            { text: "A", correct: true },
            { text: "B", correct: false },
          ],
        },
      },
    ],
    passPercentage: 50,
    behaviour: { enableRetry: true, showProgressBar: true },
  },
  "hotspot-3d": {
    version: "1.0",
    title: "Untitled 3D hotspot",
    prompt: "<p>Click the correct part.</p>",
    model: {
      src: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoomBox/glTF-Binary/BoomBox.glb",
      scale: 50,
    },
    camera: { mode: "orbit", initialDistance: 0.6 },
    hotspots: [
      {
        id: "part-a",
        label: "Part A",
        position: { x: 0, y: 0.05, z: 0.07 },
        radius: 0.03,
        correct: true,
      },
      {
        id: "part-b",
        label: "Part B",
        position: { x: 0.18, y: 0, z: 0.05 },
        radius: 0.04,
        correct: false,
      },
    ],
    behaviour: { enableRetry: true, showHotspotMarkers: true, allowOrbit: true },
  },
  "virtual-tour": {
    version: "1.0",
    title: "Untitled tour",
    scene: {
      src: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
      spawn: { position: { x: 0, y: 0.5, z: 4 } },
    },
    movement: { mode: "firstPerson", speed: 2 },
    overlays: [
      {
        id: "stop-1",
        title: "Point of interest",
        position: { x: 0, y: 0, z: 0 },
        trigger: "click",
        content: [{ type: "text", html: "<p>Describe this point.</p>" }],
      },
    ],
    completion: { mode: "manual" },
    behaviour: { enableRetry: true, showOverlayMarkers: true },
  },
};

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  "multiple-choice": "Multiple Choice",
  "fill-in-the-blanks": "Fill in the Blanks",
  "drag-and-drop": "Drag and Drop",
  "course-presentation": "Course Presentation",
  "question-set": "Question Set",
  "hotspot-3d": "3D Hotspot Identification",
  "virtual-tour": "Virtual Environment Tour",
};
