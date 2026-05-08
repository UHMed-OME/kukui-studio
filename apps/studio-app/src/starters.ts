/**
 * Minimal valid config per activity kind, used as the initial form value
 * when an author creates a new activity (or hits Reset).
 */
import type { ActivityKind } from "@kukui/core";
import { PLANNED_LABELS, PLANNED_ACTIVITY_KINDS, PLANNED_DESCRIPTIONS } from "@kukui/core";

const stubStarter = (label: string, description: string): unknown => ({
  version: "1.0",
  title: label,
  description,
  notes: "",
});

const PLANNED_STARTERS = Object.fromEntries(
  PLANNED_ACTIVITY_KINDS.map((k) => [k, stubStarter(PLANNED_LABELS[k], PLANNED_DESCRIPTIONS[k])]),
) as Record<(typeof PLANNED_ACTIVITY_KINDS)[number], unknown>;

export const STARTERS: Record<ActivityKind, unknown> = {
  "multiple-choice": {
    version: "1.0",
    title: "Multiple Choice",
    question: "Replace this with your question.",
    answers: [
      { text: "Option A", correct: true },
      { text: "Option B", correct: false },
    ],
    behaviour: { enableRetry: true, enableSolutionsButton: false, singlePoint: false },
  },
  "fill-in-the-blanks": {
    version: "1.0",
    title: "Fill in the Blanks",
    text: "Photosynthesis takes in *carbon dioxide* and releases *oxygen*.",
    behaviour: { enableRetry: true, caseSensitive: false },
  },
  "drag-and-drop": {
    version: "1.0",
    title: "Drag and Drop",
    background: {
      src: "https://placehold.co/1024x640/e8f5e9/2e6e41?text=Background+image",
      alt: "Replace this placeholder with a description of your background image",
    },
    draggables: [{ id: "d1", label: "Label A", correctZones: ["z1"] }],
    dropZones: [{ id: "z1", label: "Zone 1", rect: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 } }],
    behaviour: { enableRetry: true },
  },
  "course-presentation": {
    version: "1.0",
    title: "Course Presentation",
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
    title: "Question Set",
    questions: [
      {
        type: "multipleChoice",
        config: {
          version: "1.0",
          title: "Question 1",
          question: "What's the answer?",
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
    title: "3D Hotspot",
    prompt: "Click the correct part.",
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
    title: "Image Hotspot",
    prompt: "Click the correct region.",
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
    title: "Virtual Tour",
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
        content: [{ type: "text", html: "Describe this point." }],
      },
    ],
    completion: { mode: "manual" },
    behaviour: { enableRetry: true, showOverlayMarkers: true },
  },
  "sequence-steps": {
    version: "1.0",
    title: "Sequence Steps",
    prompt: "Order these into the correct sequence.",
    steps: [
      { id: "s1", text: "First step" },
      { id: "s2", text: "Second step" },
      { id: "s3", text: "Third step" },
    ],
    behaviour: { enableRetry: true, randomize: true },
  },
  "matching-pairs": {
    version: "1.0",
    title: "Matching Pairs",
    prompt: "Match each item on the left to its partner on the right.",
    pairs: [
      { id: "p1", left: { text: "Left A" }, right: { text: "Right A" } },
      { id: "p2", left: { text: "Left B" }, right: { text: "Right B" } },
    ],
    behaviour: { enableRetry: true, randomizeRight: true },
  },
  categorization: {
    version: "1.0",
    title: "Categorization",
    prompt: "Sort each item into the correct category.",
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
    title: "Anatomy Labeling",
    prompt: "Drag each label onto the correct target.",
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
    title: "Image Comparison",
    prompt: "Drag the slider to compare the two images.",
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
    title: "Highlight Text",
    prompt: "Highlight the verbs in this sentence.",
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
    title: "Flashcards",
    prompt: "Flip each card; rate yourself honestly.",
    cards: [
      { id: "c1", front: "Front 1", back: "Back 1" },
      { id: "c2", front: "Front 2", back: "Back 2" },
    ],
    behaviour: { shuffle: true },
  },
  "reflection-prompt": {
    version: "1.0",
    title: "Reflection Prompt",
    prompt: "Reflect on what you learned today.",
    minWords: 30,
    placeholder: "Type your reflection here…",
  },
  "branching-scenario": {
    version: "1.0",
    title: "Branching Scenario",
    startNodeId: "n1",
    nodes: [
      {
        id: "n1",
        prompt: "What's your first move?",
        choices: [
          { id: "c1", text: "Option A", nextNodeId: "n2" },
          { id: "c2", text: "Option B", nextNodeId: "n3" },
        ],
      },
      {
        id: "n2",
        prompt: "Outcome A.",
        choices: null,
        outcome: { score: 1, success: true, message: "Good call." },
      },
      {
        id: "n3",
        prompt: "Outcome B.",
        choices: null,
        outcome: { score: 0, success: false, message: "Try again." },
      },
    ],
    behaviour: { enableRetry: true },
  },
  "image-annotation": {
    version: "1.0",
    title: "Image Annotation",
    prompt: "Annotate the image.",
    image: {
      src: "https://placehold.co/1024x768/eef0f6/4b5563?text=Image",
      alt: "Image to annotate",
    },
    tools: { rectangle: true, circle: true, freehand: true },
    behaviour: { enableRetry: true },
  },
  "concept-map": {
    version: "1.0",
    title: "Concept Map",
    prompt: "Build a concept map.",
    seedNodes: [
      { id: "n1", label: "Concept A", position: { x: 0.3, y: 0.4 } },
      { id: "n2", label: "Concept B", position: { x: 0.7, y: 0.4 } },
    ],
    behaviour: { enableRetry: true, allowFreeText: true },
  },
  "interactive-video": {
    version: "1.0",
    title: "Interactive Video",
    video: {
      src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      type: "html5",
    },
    interactions: [],
    behaviour: { enableRetry: true },
  },
  "audio-recording": {
    version: "1.0",
    title: "Audio Recording",
    prompt: "Record yourself reading the passage.",
    maxDurationSeconds: 60,
    minDurationSeconds: 3,
    behaviour: { allowReRecord: true },
  },
  "lab-panel": {
    version: "1.0",
    title: "Lab Panel",
    prompt: "Identify abnormal values and pick the best interpretation.",
    panel: {
      name: "Sample panel",
      values: [
        { id: "v1", analyte: "Analyte A", result: "10", isAbnormal: false },
        { id: "v2", analyte: "Analyte B", result: "100", isAbnormal: true },
      ],
    },
    interpretation: {
      question: "What's the best interpretation?",
      choices: [
        { id: "c1", text: "Option A", correct: true },
        { id: "c2", text: "Option B", correct: false },
      ],
    },
    behaviour: { enableRetry: true },
  },
  "ddx-tree": {
    version: "1.0",
    title: "Differential Diagnosis",
    caseHeader: "Patient presents with…",
    startNodeId: "n1",
    nodes: [
      {
        id: "n1",
        presentation: "Choose your next step.",
        choices: [
          { id: "c1", text: "Test A", nextNodeId: "n2" },
          { id: "c2", text: "Test B", nextNodeId: "n3" },
        ],
      },
      {
        id: "n2",
        presentation: "Result A.",
        choices: null,
        diagnosis: { name: "Diagnosis A", correct: true, score: 1 },
      },
      {
        id: "n3",
        presentation: "Result B.",
        choices: null,
        diagnosis: { name: "Diagnosis B", correct: false, score: 0 },
      },
    ],
    behaviour: { enableRetry: true },
  },
  osce: {
    version: "1.0",
    title: "OSCE Encounter",
    caseHeader: "Patient presentation: …",
    phases: [
      {
        id: "history",
        name: "History",
        actions: [
          { id: "a1", text: "Ask about chest pain", correct: true },
          { id: "a2", text: "Ask about diet preferences", correct: false },
        ],
      },
      {
        id: "exam",
        name: "Exam",
        actions: [
          { id: "a3", text: "Auscultate the heart", correct: true },
          { id: "a4", text: "Palpate the calves", correct: true },
        ],
      },
    ],
    expectedOrder: ["history", "exam"],
    behaviour: { enableRetry: true },
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
  "branching-scenario": "Branching Scenario",
  "image-annotation": "Image Annotation / Draw",
  "concept-map": "Concept Map",
  "interactive-video": "Interactive Video",
  "audio-recording": "Audio Recording / Pronunciation",
  "lab-panel": "Lab Panel Interpretation",
  "ddx-tree": "Differential Diagnosis Tree",
  osce: "OSCE Clinical Encounter",
  ...PLANNED_LABELS,
} as Record<ActivityKind, string>;
