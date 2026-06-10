import { describe, expect, it } from "vitest";
import LZString from "lz-string";
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

  it("rejects payloads with missing or wrong-typed fields", () => {
    // A completion code is learner-supplied — craft codes around the
    // encoder to simulate tampering.
    const forge = (json: string) => LZString.compressToEncodedURIComponent(json);
    const bad = [
      '{"v":2,"k":"x","r":8,"m":10,"p":true}', // wrong version
      '{"v":1,"r":8,"m":10,"p":true}', // k missing
      '{"v":1,"k":"x","m":10,"p":true}', // r missing
      '{"v":1,"k":"x","r":"8","m":10,"p":true}', // r not a number
      '{"v":1,"k":"x","r":1e999,"m":10,"p":true}', // r not finite
      '{"v":1,"k":"x","r":8,"m":"10","p":true}', // m not a number
      '{"v":1,"k":"x","r":8,"m":10,"p":1}', // p not a boolean
      '{"v":1,"k":"x","r":8,"m":10,"p":true,"t":42}', // t not a string
      '{"v":1,"k":"x","r":8,"m":10,"p":true,"n":{}}', // n not a string
      '{"v":1,"k":"x","r":8,"m":10,"p":true,"at":[]}', // at not a string
      '"a string"',
      "null",
      "[1,2,3]",
    ];
    for (const json of bad) {
      expect(decodeCompletionCode(forge(json)), json).toBeUndefined();
    }
    // Sanity check: the same shape with correct types decodes.
    expect(
      decodeCompletionCode(forge('{"v":1,"k":"x","r":8,"m":10,"p":true}'))?.k,
    ).toBe("x");
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
