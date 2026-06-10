import LZString from "lz-string";
import type { ScoreState, InteractionRecord } from "./types.js";
import type { WebResults } from "./scorm.js";

/**
 * Helpers for the non-LMS "web" distribution's results-collection surface.
 *
 * Three backend-free channels share this module:
 *   - a short, copy-pasteable **completion code** (LZ-compressed, URL-safe)
 *     that a learner can email/paste back as lightweight proof of completion;
 *   - a full **results JSON** download (score + every interaction);
 *   - an author-supplied **webhook** POST of that same JSON.
 *
 * None of this is tamper-proof — there is no server attesting the learner —
 * so it is for formative / low-stakes use. SCORM remains the graded path.
 */

/** Compact, transport-friendly shape encoded into a completion code. */
export interface CompletionPayload {
  /** Schema version of the code, so future changes can branch on it. */
  v: 1;
  /** Activity kind. */
  k: string;
  /** Activity title, when the config supplied one. */
  t?: string;
  /** Raw score. */
  r: number;
  /** Max score. */
  m: number;
  /** Passed / failed. */
  p: boolean;
  /** Learner name, when web mode captured one. */
  n?: string;
  /** Completion timestamp (ISO). */
  at?: string;
}

export function buildPayload(
  kind: string,
  title: string | undefined,
  score: ScoreState,
  results?: WebResults,
): CompletionPayload {
  const payload: CompletionPayload = {
    v: 1,
    k: kind,
    r: score.raw,
    m: score.max,
    p: score.success,
  };
  if (title) payload.t = title;
  if (results?.name) payload.n = results.name;
  if (results?.finishedAt) payload.at = results.finishedAt;
  return payload;
}

/** Percentage 0–100, rounded, matching the SCORM scaling (max 0 → 0). */
export function scorePercent(raw: number, max: number): number {
  return max === 0 ? 0 : Math.round((raw / max) * 100);
}

export function encodeCompletionCode(payload: CompletionPayload): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeCompletionCode(code: string): CompletionPayload | undefined {
  const json = LZString.decompressFromEncodedURIComponent(code.trim());
  if (!json) return undefined;
  try {
    // The code is learner-supplied — validate every field, not just the
    // version tag, so a tampered payload can't smuggle wrong types into
    // whatever renders the decoded result.
    const obj = JSON.parse(json) as Partial<CompletionPayload>;
    if (
      !obj ||
      obj.v !== 1 ||
      typeof obj.k !== "string" ||
      typeof obj.r !== "number" ||
      !Number.isFinite(obj.r) ||
      typeof obj.m !== "number" ||
      typeof obj.p !== "boolean"
    ) {
      return undefined;
    }
    if (obj.t !== undefined && typeof obj.t !== "string") return undefined;
    if (obj.n !== undefined && typeof obj.n !== "string") return undefined;
    if (obj.at !== undefined && typeof obj.at !== "string") return undefined;
    return obj as CompletionPayload;
  } catch {
    return undefined;
  }
}

/** Full, human-readable results document for the JSON download / webhook. */
export interface ResultsDocument {
  kind: string;
  title?: string;
  score: { raw: number; max: number; percent: number; passed: boolean };
  name?: string;
  finishedAt?: string;
  interactions: InteractionRecord[];
}

export function buildResultsDocument(
  kind: string,
  title: string | undefined,
  score: ScoreState,
  results?: WebResults,
): ResultsDocument {
  return {
    kind,
    title,
    score: {
      raw: score.raw,
      max: score.max,
      percent: scorePercent(score.raw, score.max),
      passed: score.success,
    },
    name: results?.name,
    finishedAt: results?.finishedAt,
    interactions: results?.interactions ?? [],
  };
}
