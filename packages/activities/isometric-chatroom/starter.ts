/**
 * Minimal valid config used as Studio's "new activity" template.
 * Extracted from apps/studio-app/src/starters.ts (LEGACY_STARTERS).
 *
 * The `live` block intentionally omits `joinKey` / `adminKey` so the
 * raw starter validates against the schema (those fields are required
 * to be 4..64 chars when present). Studio's `ensureFreshKeys()` adds
 * them with freshly-generated values whenever this starter is applied
 * (new draft, Reset, or kind switch), so two authors never accidentally
 * ship with the same admin key. `signaling: "nostr"` is preserved as
 * the preferred default transport.
 */
const starter = {
  version: "1.0",
  title: "Discussion Chatroom",
  prompt:
    "Welcome! Pick a character, explore the room, and join the discussion when the instructor starts.",
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
      sprite:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      availableToStudents: true,
    },
    {
      id: "student-f-default",
      label: "Student (alt)",
      sprite:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      availableToStudents: true,
    },
    {
      id: "robot-default",
      label: "Robot",
      sprite:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
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
    custom: [
      { name: "Thumbs up", char: "👍" },
      { name: "Thinking", char: "🤔" },
      { name: "Clap", char: "👏" },
      { name: "Question", char: "❓" },
    ],
  },
  appearance: { theme: "auto" },
  live: {
    signaling: "nostr",
  },
};

export default starter;
