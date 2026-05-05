import { describe, expect, it } from "vitest";
import { aggregate, bandMessage, percentage, scoreSelection } from "./scoring.js";

describe("scoreSelection", () => {
  const correct = new Set([0, 2]);

  it("awards full credit when the exact correct set is chosen (multi)", () => {
    const r = scoreSelection({
      selectedIndices: new Set([0, 2]),
      correctIndices: correct,
      totalAnswers: 4,
    });
    expect(r).toEqual({ raw: 2, max: 2, success: true });
  });

  it("awards partial credit by default (one correct, one wrong)", () => {
    const r = scoreSelection({
      selectedIndices: new Set([0, 1]),
      correctIndices: correct,
      totalAnswers: 4,
    });
    expect(r).toEqual({ raw: 0, max: 2, success: false });
  });

  it("clamps partial credit at zero (no negative scores)", () => {
    const r = scoreSelection({
      selectedIndices: new Set([1, 3]),
      correctIndices: correct,
      totalAnswers: 4,
    });
    expect(r.raw).toBe(0);
  });

  it("singlePoint=true is all-or-nothing", () => {
    const r1 = scoreSelection({
      selectedIndices: new Set([0]),
      correctIndices: correct,
      totalAnswers: 4,
      singlePoint: true,
    });
    const r2 = scoreSelection({
      selectedIndices: new Set([0, 2]),
      correctIndices: correct,
      totalAnswers: 4,
      singlePoint: true,
    });
    expect(r1).toEqual({ raw: 0, max: 1, success: false });
    expect(r2).toEqual({ raw: 1, max: 1, success: true });
  });

  it("single-correct, right answer scores 1/1 success", () => {
    const r = scoreSelection({
      selectedIndices: new Set([1]),
      correctIndices: new Set([1]),
      totalAnswers: 3,
    });
    expect(r).toEqual({ raw: 1, max: 1, success: true });
  });
});

describe("aggregate", () => {
  it("sums raw and max, computes success against pass percent", () => {
    const r = aggregate(
      [
        { raw: 1, max: 2, success: false },
        { raw: 3, max: 3, success: true },
      ],
      50,
    );
    expect(r).toEqual({ raw: 4, max: 5, success: true });
  });

  it("returns success=false when no max", () => {
    const r = aggregate([], 50);
    expect(r).toEqual({ raw: 0, max: 0, success: false });
  });
});

describe("percentage", () => {
  it("rounds to nearest integer", () => {
    expect(percentage({ raw: 1, max: 3 })).toBe(33);
    expect(percentage({ raw: 2, max: 3 })).toBe(67);
  });
  it("returns 0 when max is 0", () => {
    expect(percentage({ raw: 0, max: 0 })).toBe(0);
  });
});

describe("bandMessage", () => {
  const bands = [
    { from: 0, to: 50, message: "low" },
    { from: 51, to: 99, message: "mid" },
    { from: 100, to: 100, message: "high" },
  ];
  it("matches the band the percent falls inside", () => {
    expect(bandMessage(bands, 0)).toBe("low");
    expect(bandMessage(bands, 50)).toBe("low");
    expect(bandMessage(bands, 75)).toBe("mid");
    expect(bandMessage(bands, 100)).toBe("high");
  });
  it("returns null when no band matches", () => {
    expect(bandMessage(undefined, 50)).toBe(null);
  });
});
