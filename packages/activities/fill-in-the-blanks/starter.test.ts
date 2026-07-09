import { describe, it, expect } from "vitest";
import starter from "./starter.js";
import { FillInTheBlanksConfigSchema, parseClozeText } from "./schema.js";

describe("fill-in-the-blanks starter", () => {
  it("validates against the schema", () => {
    const result = FillInTheBlanksConfigSchema.safeParse(starter);
    if (!result.success) {
      console.error("starter failed validation:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});

describe("parseClozeText", () => {
  it("splits alternates on | only; / is literal", () => {
    const parts = parseClozeText("Value: *a|b* and *mg/dL*.");
    const blanks = parts.filter((p) => p.kind === "blank");
    expect(blanks).toEqual([
      { kind: "blank", accepts: ["a", "b"] },
      { kind: "blank", accepts: ["mg/dL"] },
    ]);
  });

  it("treats \\* as a literal asterisk, inside and outside blanks", () => {
    const parts = parseClozeText("A footnote\\* and *five \\* five*.");
    expect(parts).toEqual([
      { kind: "text", text: "A footnote* and " },
      { kind: "blank", accepts: ["five * five"] },
      { kind: "text", text: "." },
    ]);
  });

  it("keeps an unterminated * as literal text", () => {
    const parts = parseClozeText("Just a lone * star");
    expect(parts).toEqual([{ kind: "text", text: "Just a lone * star" }]);
  });
});

describe("schema refinements", () => {
  it("rejects text with no blank markers", () => {
    const result = FillInTheBlanksConfigSchema.safeParse({
      version: "1.0",
      title: "T",
      text: "No blanks here, just a footnote\\*.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects blanks that parse to zero accepted answers (** or *|*)", () => {
    for (const text of ["Empty ** blank.", "Pipe-only *|* blank."]) {
      const result = FillInTheBlanksConfigSchema.safeParse({
        version: "1.0",
        title: "T",
        text,
      });
      expect(result.success).toBe(false);
    }
  });
});
