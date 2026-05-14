import { describe, expect, it } from "vitest";
import { truncateResponse } from "./interaction-encoding.js";

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
