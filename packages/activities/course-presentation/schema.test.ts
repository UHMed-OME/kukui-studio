import { describe, it, expect } from "vitest";
import { CoursePresentationConfigSchema } from "./schema.js";

const base = {
  version: "1.0",
  title: "Deck",
  appearance: { theme: "auto" as const },
};

const imageSlide = (id: string, overlays: unknown[] = []) => ({
  id,
  background: {
    kind: "image" as const,
    assetId: "a1",
    alt: "slide",
    naturalWidth: 1280,
    naturalHeight: 720,
  },
  overlays,
});

describe("CoursePresentationConfigSchema", () => {
  it("accepts an image slide with no src (assetId only)", () => {
    const r = CoursePresentationConfigSchema.safeParse({
      ...base,
      slides: [imageSlide("s1")],
    });
    expect(r.success).toBe(true);
  });

  it("accepts a blank divider slide", () => {
    const r = CoursePresentationConfigSchema.safeParse({
      ...base,
      slides: [{ id: "s1", background: { kind: "blank" }, overlays: [] }],
    });
    expect(r.success).toBe(true);
  });

  it("defaults overlays to an empty array when omitted", () => {
    const r = CoursePresentationConfigSchema.safeParse({
      ...base,
      slides: [{ id: "s1", background: { kind: "blank" } }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.slides[0]!.overlays).toEqual([]);
  });

  it("accepts info and checkpoint overlays", () => {
    const r = CoursePresentationConfigSchema.safeParse({
      ...base,
      slides: [
        imageSlide("s1", [
          { kind: "info", id: "i1", rect: { x: 0, y: 0, w: 0.2, h: 0.1 }, label: "More" },
          {
            kind: "checkpoint",
            id: "c1",
            rect: { x: 0.5, y: 0.5, w: 0.2, h: 0.1 },
            required: true,
            activity: { kind: "multipleChoice", config: { anything: true } },
          },
        ]),
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects a rect outside 0..1", () => {
    const r = CoursePresentationConfigSchema.safeParse({
      ...base,
      slides: [imageSlide("s1", [{ kind: "info", id: "i1", rect: { x: 0, y: 0, w: 1.5, h: 0.1 }, label: "x" }])],
    });
    expect(r.success).toBe(false);
  });

  it("rejects duplicate slide ids", () => {
    const r = CoursePresentationConfigSchema.safeParse({
      ...base,
      slides: [imageSlide("dup"), imageSlide("dup")],
    });
    expect(r.success).toBe(false);
  });

  it("rejects duplicate overlay ids within a slide", () => {
    const r = CoursePresentationConfigSchema.safeParse({
      ...base,
      slides: [
        imageSlide("s1", [
          { kind: "info", id: "same", rect: { x: 0, y: 0, w: 0.2, h: 0.1 }, label: "a" },
          { kind: "info", id: "same", rect: { x: 0.3, y: 0, w: 0.2, h: 0.1 }, label: "b" },
        ]),
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty deck", () => {
    const r = CoursePresentationConfigSchema.safeParse({ ...base, slides: [] });
    expect(r.success).toBe(false);
  });
});
