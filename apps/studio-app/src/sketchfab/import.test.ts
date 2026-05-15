import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { importFromSketchfab } from "./import.js";
import { loadCachedModelBlob, clearAllCachedModels } from "./modelCache.js";

const TOKEN = "test-token";
const UID = "a1b2c3d4e5f67890abcdef1234567890";
const METADATA_OK = {
  uid: UID,
  name: "Test Heart",
  user: { username: "drsmith", profileUrl: "https://sketchfab.com/drsmith" },
  viewerUrl: `https://sketchfab.com/3d-models/${UID}`,
  license: { slug: "by", label: "CC Attribution", url: "https://example.com/by" },
  isDownloadable: true,
};

type StubResponse = { ok: boolean; status?: number; body?: unknown; blob?: Blob };

function stubFetch(responses: StubResponse[]) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++] ?? { ok: false, status: 500 };
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      statusText: r.ok ? "OK" : "Error",
      json: async () => r.body,
      blob: async () => r.blob ?? new Blob(["body"]),
    } as Response;
  });
}

describe("importFromSketchfab", () => {
  beforeEach(async () => {
    await clearAllCachedModels();
  });
  afterEach(async () => {
    await clearAllCachedModels();
    vi.unstubAllGlobals();
  });

  it("returns ok and caches the blob on the happy path", async () => {
    vi.stubGlobal("fetch", stubFetch([
      { ok: true, body: METADATA_OK },
      { ok: true, body: { glb: { url: "https://signed.example/heart.glb" } } },
      { ok: true, blob: new Blob([new Uint8Array([0x67, 0x6c, 0x54, 0x46])], { type: "model/gltf-binary" }) },
    ]));
    const result = await importFromSketchfab("https://sketchfab.com/3d-models/heart-" + UID, TOKEN);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.uid).toBe(UID);
    expect(result.attribution.author).toBe("drsmith");
    expect(result.attribution.license).toContain("Attribution");
    const cached = await loadCachedModelBlob(UID);
    expect(cached).not.toBeNull();
  });

  it("rejects when license is CC-BY-ND", async () => {
    vi.stubGlobal("fetch", stubFetch([
      { ok: true, body: { ...METADATA_OK, license: { slug: "by-nd", label: "CC BY-ND", url: "" } } },
    ]));
    const result = await importFromSketchfab(UID, TOKEN);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.message.toLowerCase()).toContain("derivative");
  });

  it("rejects when isDownloadable is false", async () => {
    vi.stubGlobal("fetch", stubFetch([
      { ok: true, body: { ...METADATA_OK, isDownloadable: false } },
    ]));
    const result = await importFromSketchfab(UID, TOKEN);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.message.toLowerCase()).toMatch(/download|permission/);
  });

  it("rejects when extractModelUid returns null", async () => {
    const result = await importFromSketchfab("not a sketchfab url", TOKEN);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.message.toLowerCase()).toContain("url");
  });

  it("rejects when metadata fetch fails", async () => {
    vi.stubGlobal("fetch", stubFetch([{ ok: false, status: 401 }]));
    const result = await importFromSketchfab(UID, TOKEN);
    expect(result.kind).toBe("error");
  });

  it("rejects when no GLB URL in download response", async () => {
    vi.stubGlobal("fetch", stubFetch([
      { ok: true, body: METADATA_OK },
      { ok: true, body: { gltf: { url: "https://signed.example/heart.gltf" } } },
    ]));
    const result = await importFromSketchfab(UID, TOKEN);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.message.toLowerCase()).toContain("glb");
  });
});
