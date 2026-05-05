import { describe, expect, it, beforeEach, vi } from "vitest";
import { z } from "zod";
import { ContentLoadError, loadContent } from "./content.js";

const Schema = z
  .object({
    version: z.string(),
    title: z.string(),
  })
  .strict();

describe("loadContent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the parsed config when JSON validates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ version: "1.0", title: "Hi" }))),
    );
    const result = await loadContent("/x.json", Schema);
    expect(result).toEqual({ version: "1.0", title: "Hi" });
  });

  it("throws ContentLoadError on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    await expect(loadContent("/x.json", Schema)).rejects.toBeInstanceOf(ContentLoadError);
  });

  it("throws ContentLoadError on malformed JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json")));
    await expect(loadContent("/x.json", Schema)).rejects.toBeInstanceOf(ContentLoadError);
  });

  it("throws ContentLoadError with issues when schema rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ version: 1, title: 2 }))),
    );
    try {
      await loadContent("/x.json", Schema);
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ContentLoadError);
      expect((err as ContentLoadError).issues?.length).toBeGreaterThan(0);
    }
  });

  it("throws ContentLoadError on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(loadContent("/x.json", Schema)).rejects.toBeInstanceOf(ContentLoadError);
  });
});
