import { describe, expect, it } from "vitest";
import {
  buildPayload,
  buildResultsDocument,
  decodeCompletionCode,
  encodeCompletionCode,
  scorePercent,
} from "./web-results.js";
import type { ScoreState } from "./types.js";
import type { WebResults } from "./scorm.js";

const score: ScoreState = { raw: 8, max: 10, success: true };

describe("scorePercent", () => {
  it("scales raw/max to a rounded 0–100", () => {
    expect(scorePercent(8, 10)).toBe(80);
    expect(scorePercent(1, 3)).toBe(33);
  });
  it("returns 0 when max is 0 (avoids divide-by-zero)", () => {
    expect(scorePercent(0, 0)).toBe(0);
  });
});

describe("completion code round-trip", () => {
  it("encodes and decodes a payload losslessly", () => {
    const payload = buildPayload("multiple-choice", "Cranial Nerves", score, {
      interactions: [],
      name: "Pat",
      finishedAt: "2026-06-03T00:00:00.000Z",
    });
    const code = encodeCompletionCode(payload);
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(0);

    const decoded = decodeCompletionCode(code);
    expect(decoded).toEqual(payload);
    expect(decoded?.k).toBe("multiple-choice");
    expect(decoded?.p).toBe(true);
    expect(decoded?.n).toBe("Pat");
  });

  it("omits optional fields when absent", () => {
    const payload = buildPayload("flashcards", undefined, score);
    expect(payload.t).toBeUndefined();
    expect(payload.n).toBeUndefined();
    const decoded = decodeCompletionCode(encodeCompletionCode(payload));
    expect(decoded?.k).toBe("flashcards");
  });

  it("returns undefined for garbage or tampered codes", () => {
    expect(decodeCompletionCode("not-a-real-code")).toBeUndefined();
    expect(decodeCompletionCode("")).toBeUndefined();
  });
});

describe("buildResultsDocument", () => {
  it("includes scaled percent, pass flag, and interactions", () => {
    const results: WebResults = {
      interactions: [
        {
          id: "multiple-choice:q1",
          type: "choice",
          studentResponse: "a",
          result: { kind: "correct" },
        },
      ],
      name: "Pat",
      finishedAt: "2026-06-03T00:00:00.000Z",
    };
    const doc = buildResultsDocument("multiple-choice", "Cranial Nerves", score, results);
    expect(doc.score).toEqual({ raw: 8, max: 10, percent: 80, passed: true });
    expect(doc.interactions).toHaveLength(1);
    expect(doc.name).toBe("Pat");
    expect(doc.title).toBe("Cranial Nerves");
  });

  it("defaults interactions to an empty array when no results", () => {
    const doc = buildResultsDocument("flashcards", undefined, score);
    expect(doc.interactions).toEqual([]);
  });
});
