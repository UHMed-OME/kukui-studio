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
  live: { signaling: "nostr" },
};

export default starter;
