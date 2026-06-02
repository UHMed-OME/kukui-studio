import { describe, it, expect } from "vitest";
import { cuesToVtt, type Cue } from "./transcribe.js";

describe("cuesToVtt", () => {
  it("serializes cues to a WebVTT document with HH:MM:SS.mmm timestamps", () => {
    const cues: Cue[] = [
      { start: 0, end: 2.5, text: "Hello there." },
      { start: 2.5, end: 65.25, text: "This is my reflection." },
    ];
    const vtt = cuesToVtt(cues);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> 00:00:02.500");
    expect(vtt).toContain("Hello there.");
    // 65.25s → 00:01:05.250
    expect(vtt).toContain("00:01:05.250");
    expect(vtt).toContain("This is my reflection.");
    // Cue indices present.
    expect(vtt).toMatch(/\n1\n/);
    expect(vtt).toMatch(/\n2\n/);
  });

  it("handles an empty cue list without throwing", () => {
    expect(cuesToVtt([])).toContain("WEBVTT");
  });
});
