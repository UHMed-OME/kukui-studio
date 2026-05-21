/**
 * Minimal valid config per activity kind, used as the initial form value
 * when an author creates a new activity (or hits Reset).
 */
import type { ActivityKind } from "@kukui/core";
import { PLANNED_LABELS, PLANNED_ACTIVITY_KINDS, PLANNED_DESCRIPTIONS } from "@kukui/core";
import { ACTIVITY_MANIFESTS } from "@kukui/activities";

/**
 * Inline SVG placeholder, embedded as a data URL so it travels with the
 * starter config into the SCORM zip + downloaded JSON + the engine
 * preview without depending on a bundled asset path. Subtle kukui-brown
 * gradient + dot pattern + nut watermark + instructional caption.
 *
 * Authors can replace it via the file upload widget; they can also
 * clear the image entirely now that image fields are optional.
 */
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 640" role="img" aria-label="Image placeholder"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4ede2"/><stop offset="1" stop-color="#e9dec9"/></linearGradient><pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r="1.5" fill="#bbae9a" opacity="0.45"/></pattern></defs><rect width="1024" height="640" fill="url(#bg)"/><rect width="1024" height="640" fill="url(#dots)"/><g transform="translate(512 280)" fill="#7b4324" opacity="0.18"><ellipse cx="0" cy="10" rx="90" ry="80"/><ellipse cx="0" cy="10" rx="70" ry="60" fill="#f4ede2"/></g><g transform="translate(512 420)" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" fill="#7b4324"><text x="0" y="0" font-size="22" font-weight="600" opacity="0.85">Replace this with your image</text><text x="0" y="32" font-size="14" opacity="0.6">Or delete it — image is optional</text></g></svg>`,
  );

const stubStarter = (label: string, description: string): unknown => ({
  version: "1.0",
  title: label,
  description,
  notes: "",
});

const PLANNED_STARTERS = Object.fromEntries(
  PLANNED_ACTIVITY_KINDS.map((k) => [k, stubStarter(PLANNED_LABELS[k], PLANNED_DESCRIPTIONS[k])]),
) as Record<(typeof PLANNED_ACTIVITY_KINDS)[number], unknown>;

const LEGACY_STARTERS: Partial<Record<ActivityKind, unknown>> = {
  "hotspot-3d": {
    version: "1.0",
    title: "3D Hotspot",
    prompt: "Click the correct part.",
    model: {
      // Bundled Khronos Box placeholder (CC BY 4.0). External CDN URLs
      // here would break inside LMS networks that block external hosts
      // and under engine-web's strict `connect-src 'self'` CSP.
      // Authors should replace this with their own model.
      src: "samples/hotspot-3d/box.glb",
      scale: 1,
      attribution: {
        author: "Khronos Group",
        sourceUrl: "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Box",
        license: "CC BY 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      },
    },
    camera: { initialDistance: 0.6 },
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
      src: PLACEHOLDER_IMAGE,
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
      // Bundled placeholder (CC BY 4.0) — see comment under hotspot-3d.
      src: "samples/virtual-tour/box.glb",
      spawn: { position: { x: 0, y: 0.5, z: 4 } },
    },
    movement: { speed: 2 },
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
    behaviour: { enableRetry: true },
  },
  "straw-poll": {
    version: "1.0",
    title: "Pulse check",
    prompt: "How confident do you feel about today's material?",
    choices: [
      { id: "very", label: "Very confident — could teach it back" },
      { id: "mostly", label: "Mostly — minor gaps" },
      { id: "shaky", label: "Shaky — need to review" },
      { id: "lost", label: "Lost — need a re-teach" },
    ],
    behaviour: {
      showLiveResultsToStudents: true,
      allowChangeVote: true,
      showIndividualVotes: false,
    },
    live: {
      // Keys intentionally left empty here — `ensureFreshKeys` fills
      // them in with fresh randoms whenever this starter is applied
      // (new draft, Reset, or kind switch), so two authors never
      // ship with the same admin key by accident.
      joinKey: "",
      adminKey: "",
      signaling: "nostr",
    },
  },
  "confidence-meter": {
    version: "1.0",
    title: "Confidence rating",
    prompt: "How confident are you about today's material?",
    scale: {
      min: 0,
      max: 100,
      step: 1,
      lowLabel: "Lost",
      highLabel: "Could teach it",
      unit: "%",
    },
    behaviour: { showLiveResultsToStudents: true, allowChangeRating: true },
    live: { joinKey: "", adminKey: "", signaling: "nostr" },
  },
  "word-cloud": {
    version: "1.0",
    title: "Word cloud",
    prompt: "Sum up the lecture in one or two words.",
    submissionsPerStudent: 2,
    maxWordsPerSubmission: 2,
    maxCharsPerSubmission: 24,
    behaviour: { showLiveResultsToStudents: true, caseSensitive: false },
    live: { joinKey: "", adminKey: "", signaling: "nostr" },
  },
  "qa-board": {
    version: "1.0",
    title: "Class Q&A board",
    prompt: "Post any questions you have during lecture — upvote the ones you also want answered.",
    maxQuestionsPerStudent: 5,
    maxQuestionLength: 240,
    behaviour: { allowAnonymous: true, allowUpvoteOwn: false, showAnsweredBelow: true },
    live: { joinKey: "", adminKey: "", signaling: "nostr" },
  },
  "quick-quiz": {
    version: "1.0",
    title: "Quick check",
    prompt: "Which artery supplies the inferior wall of the left ventricle in most patients?",
    choices: [
      { id: "rca", label: "Right coronary artery (RCA)", correct: true },
      { id: "lad", label: "Left anterior descending (LAD)" },
      { id: "lcx", label: "Left circumflex (LCx)" },
      { id: "ramus", label: "Ramus intermedius" },
    ],
    behaviour: {
      showLiveResultsToStudents: false,
      revealCorrectAnswer: true,
      allowChangeAnswer: true,
      showNamesAtReveal: false,
    },
    live: { joinKey: "", adminKey: "", signaling: "nostr" },
  },
  "isometric-chatroom": {
    version: "1.0",
    title: "Discussion Chatroom",
    prompt: "Welcome! Pick a character, explore the room, and join the discussion when the instructor starts.",
    room: {
      name: "Classroom",
      theme: "classroom",
      width: 12,
      height: 12,
      seed: "kukui-default-v1",
    },
    characters: [
      {
        id: "student-m-default",
        label: "Student (default)",
        sprite: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        availableToStudents: true,
      },
      {
        id: "student-f-default",
        label: "Student (alt)",
        sprite: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        availableToStudents: true,
      },
      {
        id: "robot-default",
        label: "Robot",
        sprite: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        availableToStudents: true,
      },
    ],
    rules: {
      requireAcknowledge: true,
      rules: [
        "Be respectful to everyone",
        "Stay on topic during the question phase",
        "Use the emoji reactions to respond non-verbally",
      ],
      maxMessageLength: 280,
      messageDisplayDuration: 8000,
      chatMode: "free",
      allowLobbyClose: true,
      allowIndividualMute: true,
      allowMessageDeletion: true,
      showNamesInChat: true,
    },
    emoji: {
      preset: "standard",
    },
    appearance: { theme: "auto" },
    live: {
      joinKey: "",
      adminKey: "",
      signaling: "nostr",
    },
  },
};

const MANIFEST_STARTERS: Partial<Record<ActivityKind, unknown>> =
  Object.fromEntries(
    Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.starter]),
  );

export const STARTERS: Record<ActivityKind, unknown> = {
  ...PLANNED_STARTERS,
  ...LEGACY_STARTERS,
  ...MANIFEST_STARTERS,
} as Record<ActivityKind, unknown>;

const LEGACY_LABELS: Partial<Record<ActivityKind, string>> = {
  "hotspot-3d": "3D Hotspots",
  "hotspot-2d": "Image Hotspots",
  "virtual-tour": "Virtual Tour",
  "straw-poll": "Straw Poll (Live)",
  "confidence-meter": "Confidence Meter (Live)",
  "word-cloud": "Word Cloud (Live)",
  "qa-board": "Q&A Board (Live)",
  "quick-quiz": "Quick Quiz (Live)",
  "isometric-chatroom": "Pixel Chat (Live)",
};

const MANIFEST_LABELS: Partial<Record<ActivityKind, string>> =
  Object.fromEntries(
    Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.label]),
  );

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  ...PLANNED_LABELS,
  ...LEGACY_LABELS,
  ...MANIFEST_LABELS,
} as Record<ActivityKind, string>;

/**
 * Memorable join key: `adj-noun-NN`. ~6.4M combinations is plenty so
 * two simultaneous classroom rooms don't collide at the scale of a
 * single institution. Words chosen to read cleanly when an instructor
 * says them out loud.
 */
function randomJoinKey(): string {
  const adjs = [
    "bright", "calm", "clever", "fierce", "happy", "lucky", "merry",
    "quiet", "swift", "wild", "kind", "bold", "warm", "sharp", "noble",
  ];
  const nouns = [
    "badger", "cougar", "dolphin", "eagle", "falcon", "fox", "lion",
    "owl", "tiger", "wolf", "otter", "heron", "raven", "hawk", "lynx",
  ];
  const pick = (arr: readonly string[]): string =>
    arr[Math.floor(Math.random() * arr.length)] as string;
  const n = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return `${pick(adjs)}-${pick(nouns)}-${n}`;
}

/** Admin key: 16 hex chars (64-bit entropy from crypto.getRandomValues). */
function randomAdminKey(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fill in any missing live-activity keys with freshly-generated
 * randoms. Called on every fresh starter application (new draft,
 * Reset, kind switch) and on every draft load so two authors never
 * accidentally ship with the same admin key. Existing non-empty keys
 * are preserved.
 */
const LIVE_KIND_SET = new Set<ActivityKind>([
  "straw-poll",
  "confidence-meter",
  "word-cloud",
  "qa-board",
  "quick-quiz",
  "isometric-chatroom",
]);

export function ensureFreshKeys(kind: ActivityKind, value: unknown): unknown {
  if (!LIVE_KIND_SET.has(kind)) return value;
  if (!value || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const live = (obj.live && typeof obj.live === "object"
    ? obj.live
    : {}) as Record<string, unknown>;
  const joinKey =
    typeof live.joinKey === "string" && live.joinKey.length > 0
      ? live.joinKey
      : randomJoinKey();
  const adminKey =
    typeof live.adminKey === "string" && live.adminKey.length > 0
      ? live.adminKey
      : randomAdminKey();
  if (joinKey === live.joinKey && adminKey === live.adminKey) return value;
  return {
    ...obj,
    live: { ...live, joinKey, adminKey },
  };
}
