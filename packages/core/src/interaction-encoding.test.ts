import { describe, expect, it } from "vitest";
import { truncateResponse, encodeChoice, encodeMatching, encodeSequencing } from "./interaction-encoding.js";

describe("truncateResponse", () => {
  it("leaves short strings unchanged", () => {
    expect(truncateResponse("hello")).toBe("hello");
  });

  it("returns input exactly at the 255-char limit", () => {
    const s = "x".repeat(255);
    expect(truncateResponse(s)).toBe(s);
    expect(truncateResponse(s).length).toBe(255);
  });

  it("truncates over-length input with a trailing ellipsis", () => {
    const s = "x".repeat(300);
    const out = truncateResponse(s);
    expect(out.length).toBe(255);
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, 254)).toBe("x".repeat(254));
  });
});

describe("encodeChoice", () => {
  it("returns the empty string for an empty selection", () => {
    expect(encodeChoice([])).toBe("");
  });

  it("emits a bare letter for a single selection (SCORM 1.2 single-choice form)", () => {
    expect(encodeChoice([0])).toBe("a");
    expect(encodeChoice([3])).toBe("d");
  });

  it("wraps multiple selections in braces (SCORM 1.2 multi-choice form)", () => {
    expect(encodeChoice([0, 2, 4])).toBe("{a,c,e}");
  });

  it("preserves selection order in the output", () => {
    expect(encodeChoice([2, 0])).toBe("{c,a}");
  });

  it("emits two-letter labels for index >= 26", () => {
    expect(encodeChoice([26])).toBe("aa");
    expect(encodeChoice([27])).toBe("ab");
    expect(encodeChoice([51])).toBe("az");
    expect(encodeChoice([52])).toBe("ba");
  });
});

describe("encodeMatching", () => {
  it("joins pairs with `.` between and `,` across (SCORM 1.2 matching form)", () => {
    expect(
      encodeMatching([
        { left: "1", right: "a" },
        { left: "2", right: "b" },
        { left: "3", right: "c" },
      ]),
    ).toBe("1.a,2.b,3.c");
  });

  it("emits an empty right-side for unplaced left items", () => {
    expect(
      encodeMatching([
        { left: "chip-glucose", right: "" },
        { left: "chip-insulin", right: "zone-pancreas" },
      ]),
    ).toBe("chip-glucose.,chip-insulin.zone-pancreas");
  });

  it("returns the empty string for an empty list", () => {
    expect(encodeMatching([])).toBe("");
  });
});

describe("encodeSequencing", () => {
  it("joins ordered ids with commas", () => {
    expect(encodeSequencing(["a", "b", "c"])).toBe("a,b,c");
  });

  it("preserves order exactly as given", () => {
    expect(encodeSequencing(["step-3", "step-1", "step-2"])).toBe(
      "step-3,step-1,step-2",
    );
  });

  it("returns the empty string for an empty sequence", () => {
    expect(encodeSequencing([])).toBe("");
  });
});
