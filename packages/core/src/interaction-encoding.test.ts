import { describe, expect, it } from "vitest";
import { truncateResponse, encodeChoice, encodeMatching, encodeSequencing, encodeFillIn, encodePerformance, encodeLatency, encodeTimeOfDay, encodeResult } from "./interaction-encoding.js";

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

  it("clamps to 'zz' past the two-letter range instead of emitting non-letters", () => {
    expect(encodeChoice([701])).toBe("zz");
    expect(encodeChoice([702])).toBe("zz");
    expect(encodeChoice([9999])).toBe("zz");
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

  it("sanitizes separator characters inside ids so patterns stay unambiguous", () => {
    expect(
      encodeMatching([
        { left: "step.2", right: "zone,b" },
        { left: "plain", right: "ok" },
      ]),
    ).toBe("step-2.zone-b,plain.ok");
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

describe("encodeFillIn", () => {
  it("trims surrounding whitespace", () => {
    expect(encodeFillIn("  hello  ")).toBe("hello");
  });

  it("truncates long input to 255 chars with ellipsis", () => {
    const out = encodeFillIn("x".repeat(400));
    expect(out.length).toBe(255);
    expect(out.endsWith("…")).toBe(true);
  });

  it("preserves internal whitespace", () => {
    expect(encodeFillIn("multi word answer")).toBe("multi word answer");
  });

  it("handles unicode characters within byte budget", () => {
    expect(encodeFillIn("café")).toBe("café");
  });
});

describe("encodePerformance", () => {
  it("returns strings unchanged when under the cap", () => {
    expect(encodePerformance("hotspot-a,hotspot-c")).toBe("hotspot-a,hotspot-c");
  });

  it("JSON-stringifies non-string payloads", () => {
    expect(encodePerformance({ x: 12, y: 34 })).toBe('{"x":12,"y":34}');
  });

  it("truncates over-cap payloads with ellipsis", () => {
    const payload = { notes: "n".repeat(400) };
    const out = encodePerformance(payload);
    expect(out.length).toBe(255);
    expect(out.endsWith("…")).toBe(true);
  });

  it("encodes arrays of ids without quoting", () => {
    expect(encodePerformance(["a", "b", "c"])).toBe('["a","b","c"]');
  });
});

describe("encodeLatency", () => {
  it("formats sub-second values with hundredths", () => {
    expect(encodeLatency(0.5)).toBe("0000:00:00.50");
  });

  it("formats whole seconds", () => {
    expect(encodeLatency(5)).toBe("0000:00:05.00");
  });

  it("rolls over to minutes and hours", () => {
    expect(encodeLatency(65)).toBe("0000:01:05.00");
    expect(encodeLatency(3725.5)).toBe("0001:02:05.50"); // 1h 2m 5.5s
  });

  it("clamps negative input to zero", () => {
    expect(encodeLatency(-10)).toBe("0000:00:00.00");
  });

  it("handles four-digit hour values", () => {
    expect(encodeLatency(36000)).toBe("0010:00:00.00");
  });
});

describe("encodeTimeOfDay", () => {
  it("formats hours:minutes:seconds with zero padding", () => {
    const d = new Date(2026, 4, 14, 9, 5, 3); // local time
    expect(encodeTimeOfDay(d)).toBe("09:05:03");
  });
});

describe("encodeResult", () => {
  it("maps the four enum kinds to their SCORM strings", () => {
    expect(encodeResult({ kind: "correct" })).toBe("correct");
    expect(encodeResult({ kind: "wrong" })).toBe("wrong");
    expect(encodeResult({ kind: "unanticipated" })).toBe("unanticipated");
    expect(encodeResult({ kind: "neutral" })).toBe("neutral");
  });

  it("formats numeric results to two decimal places", () => {
    expect(encodeResult({ kind: "numeric", value: 0.5 })).toBe("0.50");
    expect(encodeResult({ kind: "numeric", value: 1 })).toBe("1.00");
  });
});
