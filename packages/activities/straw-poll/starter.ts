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
    signaling: "nostr",
  },
};

export default starter;
