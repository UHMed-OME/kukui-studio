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
