/**
 * Pure helpers that encode in-memory interaction data to the wire format
 * required by SCORM 1.2 §3.4.7. No DOM, no SCORM API calls, no side
 * effects — every helper is referentially transparent so it can be tested
 * exhaustively.
 */

import type { InteractionResult } from "./types.js";

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
  // these in our testing and it preserves uniqueness. Past "zz" (index
  // 701) clamp rather than emit non-letters; no activity gets close.
  const i = Math.min(index, 701);
  if (i < 26) return String.fromCharCode(97 + i);
  const first = Math.floor(i / 26) - 1;
  const second = i % 26;
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

/**
 * SCORM 1.2 §3.4.7.5 sequencing form: `a,b,c`. Used by sequence-steps and
 * ddx-tree.
 */
export function encodeSequencing(orderedIds: readonly string[]): string {
  return orderedIds.join(",");
}

/**
 * SCORM 1.2 §3.4.7.5 fill-in form: free text capped at 255 chars. Used by
 * fill-in-the-blanks, reflection-prompt, crossword, word-cloud, qa-board.
 */
export function encodeFillIn(text: string): string {
  return truncateResponse(text.trim());
}

/**
 * SCORM 1.2 §3.4.7.5 performance form: free-form text. Used by hotspot-3d,
 * highlight-text, virtual-tour, image-annotation, audio-recording,
 * image-comparison-slider, isometric-chatroom — anywhere the response
 * shape doesn't fit choice / matching / sequencing.
 *
 * Strings pass through unchanged; everything else is JSON-stringified.
 * Result is truncated to 255 chars.
 */
export function encodePerformance(payload: unknown): string {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return truncateResponse(text);
}

/**
 * SCORM 1.2 §3.4.7.10 latency, HHHH:MM:SS.SS. Negative inputs clamp to zero
 * so we never emit a malformed time string from a clock-skew edge case.
 */
export function encodeLatency(seconds: number): string {
  const totalHundredths = Math.max(0, Math.floor(seconds * 100));
  const hundredths = totalHundredths % 100;
  const totalSec = Math.floor(totalHundredths / 100);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad4 = (n: number) => String(n).padStart(4, "0");
  return `${pad4(h)}:${pad2(m)}:${pad2(s)}.${pad2(hundredths)}`;
}

/** SCORM 1.2 §3.4.7.7 time, HH:MM:SS in the learner's local timezone. */
export function encodeTimeOfDay(date: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** Map an InteractionResult to the SCORM 1.2 §3.4.7.9 string form. */
export function encodeResult(r: InteractionResult): string {
  if (r.kind === "numeric") return r.value.toFixed(2);
  return r.kind;
}
