import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  cacheModelBlob,
  loadCachedModelBlob,
  clearAllCachedModels,
  cachedModelCount,
} from "./modelCache.js";

const UID = "a1b2c3d4e5f67890abcdef1234567890";
const UID_TWO = "0000111122223333444455556666777";

function makeBlob(): Blob {
  return new Blob([new Uint8Array([0x67, 0x6c, 0x54, 0x46])], {
    type: "model/gltf-binary",
  });
}

describe("Sketchfab model cache", () => {
  beforeEach(async () => {
    await clearAllCachedModels();
  });
  afterEach(async () => {
    await clearAllCachedModels();
  });

  it("returns null for an uncached UID", async () => {
    expect(await loadCachedModelBlob(UID)).toBeNull();
  });

  it("round-trips a blob through cacheModelBlob → loadCachedModelBlob", async () => {
    const blob = makeBlob();
    await cacheModelBlob(UID, blob);
    const out = await loadCachedModelBlob(UID);
    expect(out).not.toBeNull();
    expect(out?.size).toBe(blob.size);
    expect(out?.type).toBe("model/gltf-binary");
  });

  it("overwrites an existing cached blob for the same UID", async () => {
    await cacheModelBlob(UID, new Blob(["small"]));
    await cacheModelBlob(UID, new Blob(["replaced with longer body"]));
    const out = await loadCachedModelBlob(UID);
    expect(out?.size).toBe("replaced with longer body".length);
  });

  it("tracks count across multiple UIDs", async () => {
    expect(await cachedModelCount()).toBe(0);
    await cacheModelBlob(UID, makeBlob());
    await cacheModelBlob(UID_TWO, makeBlob());
    expect(await cachedModelCount()).toBe(2);
  });

  it("clearAllCachedModels empties the store", async () => {
    await cacheModelBlob(UID, makeBlob());
    await cacheModelBlob(UID_TWO, makeBlob());
    await clearAllCachedModels();
    expect(await cachedModelCount()).toBe(0);
    expect(await loadCachedModelBlob(UID)).toBeNull();
  });
});
