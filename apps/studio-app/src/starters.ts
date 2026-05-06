/**
 * Minimal valid config per activity kind, used as the initial form value
 * when an author creates a new activity (or hits Reset).
 */
import type { ActivityKind } from "@kukui/core";
import { PLANNED_LABELS, PLANNED_ACTIVITY_KINDS, PLANNED_DESCRIPTIONS } from "@kukui/core";

const stubStarter = (label: string, description: string): unknown => ({
  version: "1.0",
  title: `Untitled ${label.toLowerCase()}`,
  description,
  notes: "",
});

const PLANNED_STARTERS = Object.fromEntries(
  PLANNED_ACTIVITY_KINDS.map((k) => [k, stubStarter(PLANNED_LABELS[k], PLANNED_DESCRIPTIONS[k])]),
) as Record<(typeof PLANNED_ACTIVITY_KINDS)[number], unknown>;

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
  "hotspot-2d": {
    version: "1.0",
    title: "Untitled image hotspot",
    prompt: "<p>Click the correct region.</p>",
    image: {
      src: "https://placehold.co/1024x640/eef0f6/4b5563?text=Image",
      alt: "Replace with the image authors will mark up",
    },
    hotspots: [
      {
        id: "h1",
        label: "Region A",
        rect: { x: 0.2, y: 0.3, w: 0.2, h: 0.2 },
        correct: true,
      },
      {
        id: "h2",
        label: "Region B",
        rect: { x: 0.6, y: 0.3, w: 0.2, h: 0.2 },
        correct: false,
      },
    ],
    behaviour: { enableRetry: true, showHotspotMarkers: true },
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
  "sequence-steps": {
    version: "1.0",
    title: "Untitled sequence",
    prompt: "<p>Order these into the correct sequence.</p>",
    steps: [
      { id: "s1", text: "First step" },
      { id: "s2", text: "Second step" },
      { id: "s3", text: "Third step" },
    ],
    behaviour: { enableRetry: true, randomize: true },
  },
  "matching-pairs": {
    version: "1.0",
    title: "Untitled matching",
    prompt: "<p>Match each item on the left to its partner on the right.</p>",
    pairs: [
      { id: "p1", left: { text: "Left A" }, right: { text: "Right A" } },
      { id: "p2", left: { text: "Left B" }, right: { text: "Right B" } },
    ],
    behaviour: { enableRetry: true, randomizeRight: true },
  },
  categorization: {
    version: "1.0",
    title: "Untitled categorization",
    prompt: "<p>Sort each item into the correct category.</p>",
    categories: [
      { id: "c1", label: "Category A" },
      { id: "c2", label: "Category B" },
    ],
    items: [
      { id: "i1", text: "Item 1", correctCategory: "c1" },
      { id: "i2", text: "Item 2", correctCategory: "c2" },
    ],
    behaviour: { enableRetry: true },
  },
  "anatomy-labeling": {
    version: "1.0",
    title: "Untitled labeling",
    prompt: "<p>Drag each label onto the correct target.</p>",
    image: {
      src: "https://placehold.co/1024x640/eef0f6/4b5563?text=Diagram",
      alt: "Diagram placeholder",
    },
    labels: [
      { id: "l1", text: "Label A", correctTargetId: "t1" },
      { id: "l2", text: "Label B", correctTargetId: "t2" },
    ],
    targets: [
      { id: "t1", position: { x: 0.3, y: 0.4 } },
      { id: "t2", position: { x: 0.7, y: 0.4 } },
    ],
    behaviour: { enableRetry: true },
  },
  "image-comparison-slider": {
    version: "1.0",
    title: "Untitled comparison",
    prompt: "<p>Drag the slider to compare the two images.</p>",
    before: {
      src: "https://placehold.co/800x600/eef0f6/4b5563?text=Before",
      alt: "Before",
    },
    after: {
      src: "https://placehold.co/800x600/d4ecd9/2e6e41?text=After",
      alt: "After",
    },
  },
  "highlight-text": {
    version: "1.0",
    title: "Untitled highlight",
    prompt: "<p>Highlight the verbs in this sentence.</p>",
    tokens: [
      { id: "t1", text: "The", correct: false },
      { id: "t2", text: "cat", correct: false },
      { id: "t3", text: "ran", correct: true },
      { id: "t4", text: "quickly", correct: false },
    ],
    behaviour: { enableRetry: true },
  },
  flashcards: {
    version: "1.0",
    title: "Untitled flashcards",
    prompt: "<p>Flip each card; rate yourself honestly.</p>",
    cards: [
      { id: "c1", front: "Front 1", back: "Back 1" },
      { id: "c2", front: "Front 2", back: "Back 2" },
    ],
    behaviour: { shuffle: true, passThreshold: 80 },
  },
  "reflection-prompt": {
    version: "1.0",
    title: "Untitled reflection",
    prompt: "<p>Reflect on what you learned today.</p>",
    minWords: 30,
    placeholder: "Type your reflection here…",
  },
  ...PLANNED_STARTERS,
} as Record<ActivityKind, unknown>;

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  "multiple-choice": "Multiple Choice",
  "fill-in-the-blanks": "Fill in the Blanks",
  "drag-and-drop": "Drag and Drop",
  "course-presentation": "Course Presentation",
  "question-set": "Question Set",
  "hotspot-3d": "3D Hotspot Identification",
  "hotspot-2d": "Image Hotspot 2D",
  "virtual-tour": "Virtual Environment Tour",
  "sequence-steps": "Sequence / Order Steps",
  "matching-pairs": "Matching Pairs",
  categorization: "Categorization",
  "anatomy-labeling": "Anatomy Labeling",
  "image-comparison-slider": "Image Comparison Slider",
  "highlight-text": "Highlight Text Spans",
  flashcards: "Flashcards / Recall Drill",
  "reflection-prompt": "Reflection Prompt",
  ...PLANNED_LABELS,
} as Record<ActivityKind, string>;
