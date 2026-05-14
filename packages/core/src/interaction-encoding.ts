/**
 * Pure helpers that encode in-memory interaction data to the wire format
 * required by SCORM 1.2 §3.4.7. No DOM, no SCORM API calls, no side
 * effects — every helper is referentially transparent so it can be tested
 * exhaustively.
 */

/** SCORM 1.2 CMIFeedback cap; applies to id, student_response, correct_responses.0.pattern. */
export const MAX_RESPONSE_CHARS = 255;

/** Trim to fit MAX_RESPONSE_CHARS, marking truncation with a trailing ellipsis. */
export function truncateResponse(text: string): string {
  if (text.length <= MAX_RESPONSE_CHARS) return text;
  return text.slice(0, MAX_RESPONSE_CHARS - 1) + "…";
}

function letterFor(index: number): string {
  // SCORM 1.2 doesn't formally support more than 26 alternatives, but
  // activities like word-cloud / large hotspot sets can exceed it.
  // Fall through to two-letter labels (aa, ab, …) — Brightspace accepts
  // these in our testing and it preserves uniqueness.
  if (index < 26) return String.fromCharCode(97 + index);
  const first = Math.floor(index / 26) - 1;
  const second = index % 26;
  return String.fromCharCode(97 + first) + String.fromCharCode(97 + second);
}

/**
 * Encode a list of zero-based answer indices per SCORM 1.2 §3.4.7.5.
 *   []        → ""
 *   [0]       → "a"
 *   [0, 2, 4] → "{a,c,e}"
 */
export function encodeChoice(indices: readonly number[]): string {
  if (indices.length === 0) return "";
  if (indices.length === 1) return letterFor(indices[0]!);
  return `{${indices.map(letterFor).join(",")}}`;
}

/**
 * SCORM 1.2 §3.4.7.5 matching form: `left.right,left.right`. Unplaced
 * left items use an empty right (`left.`). Used by drag-and-drop,
 * matching-pairs, categorization, anatomy-labeling, concept-map, lab-panel.
 */
export function encodeMatching(
  pairs: readonly { left: string; right: string }[],
): string {
  return pairs.map((p) => `${p.left}.${p.right}`).join(",");
}
