import { describe, expect, it } from "vitest";
import { Hotspot3DConfigSchema } from "./hotspot-3d.js";

const baseValid = {
  version: "1.0",
  title: "T",
  prompt: "P",
  model: {
    sketchfabUid: "a1b2c3d4e5f67890abcdef1234567890",
  },
  hotspots: [
    { id: "h1", position: { x: 0, y: 0, z: 0 }, radius: 0.1, correct: true },
    { id: "h2", position: { x: 1, y: 0, z: 0 }, radius: 0.1, correct: false },
  ],
};

describe("Hotspot3DConfigSchema", () => {
  it("accepts a minimal valid config with sketchfabUid", () => {
    const result = Hotspot3DConfigSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it("accepts config with src instead of sketchfabUid", () => {
    const result = Hotspot3DConfigSchema.safeParse({
      ...baseValid,
      model: {
        src: "https://example.com/model.glb",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects config with neither src nor sketchfabUid", () => {
    const result = Hotspot3DConfigSchema.safeParse({
      ...baseValid,
      model: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid sketchfabUid format", () => {
    const result = Hotspot3DConfigSchema.safeParse({
      ...baseValid,
      model: {
        sketchfabUid: "invalid-not-hex",
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts hotspots with minimum required fields", () => {
    const result = Hotspot3DConfigSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it("rejects fewer than 2 hotspots", () => {
    const result = Hotspot3DConfigSchema.safeParse({
      ...baseValid,
      hotspots: [
        { id: "h1", position: { x: 0, y: 0, z: 0 }, radius: 0.1, correct: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  describe("model.sketchfabMode", () => {
    it("parses without sketchfabMode (legacy embed default)", () => {
      const result = Hotspot3DConfigSchema.safeParse(baseValid);
      expect(result.success).toBe(true);
    });

    it("parses with sketchfabMode: embed", () => {
      const result = Hotspot3DConfigSchema.safeParse({
        ...baseValid,
        model: { ...baseValid.model, sketchfabMode: "embed" },
      });
      expect(result.success).toBe(true);
    });

    it("parses Studio-time import state (uid + import mode, no src)", () => {
      const result = Hotspot3DConfigSchema.safeParse({
        ...baseValid,
        model: { ...baseValid.model, sketchfabMode: "import" },
      });
      expect(result.success).toBe(true);
    });

    it("parses post-export import state (uid + import mode + relative src)", () => {
      const result = Hotspot3DConfigSchema.safeParse({
        ...baseValid,
        model: {
          ...baseValid.model,
          sketchfabMode: "import",
          src: "./assets/a1b2c3d4e5f67890abcdef1234567890.glb",
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid sketchfabMode value", () => {
      const result = Hotspot3DConfigSchema.safeParse({
        ...baseValid,
        model: { ...baseValid.model, sketchfabMode: "invalid" },
      });
      expect(result.success).toBe(false);
    });
  });
});
