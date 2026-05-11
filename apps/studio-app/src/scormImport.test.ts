import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { importFromFile } from "./scormImport.js";

/**
 * jsdom's File implementation lacks `.arrayBuffer()`, so we hand-roll a
 * minimal File-shaped object backed by a Uint8Array. importFromFile only
 * touches `.name`, `.arrayBuffer()`, and the suffix of `.name`, so this is
 * sufficient.
 */
function fakeFile(bytes: Uint8Array, name: string): File {
  return {
    name,
    type: "application/zip",
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    text: async () => new TextDecoder().decode(bytes),
    // unused by importFromFile but typed on File
    slice: () => new Blob(),
    stream: () => new ReadableStream(),
    lastModified: 0,
    webkitRelativePath: "",
  } as unknown as File;
}

/**
 * Build a SCORM-shaped zip with a `samples/<kind>/basic.json` entry containing
 * the given JSON body. Returns a File so we can hand it to importFromFile().
 */
async function buildScormZip(kind: string, body: unknown): Promise<File> {
  const zip = new JSZip();
  zip.file(`samples/${kind}/basic.json`, JSON.stringify(body));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return fakeFile(bytes, `${kind}.zip`);
}

/**
 * Build a SCORM-shaped zip whose only config entry decompresses to
 * `actualBytes` of payload. We don't try to forge a fake declared size
 * here — the measured guard inside importFromFile is the load-bearing
 * check, and a config that is honestly 2 MB also exceeds the limit.
 */
async function buildBombZip(actualBytes: number): Promise<File> {
  const big = "a".repeat(actualBytes);
  const inner = JSON.stringify({ version: "1.0", title: "Bomb", payload: big });
  const zip = new JSZip();
  zip.file("samples/multiple-choice/basic.json", inner);
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return fakeFile(bytes, "bomb.zip");
}

const VALID_MC = {
  version: "1.0",
  title: "Capital of Hawaii",
  question: "<p>What is the capital of Hawaii?</p>",
  answers: [
    { text: "Honolulu", correct: true },
    { text: "Hilo", correct: false },
  ],
};

describe("importFromFile (zip)", () => {
  it("imports a normal SCORM zip", async () => {
    const file = await buildScormZip("multiple-choice", VALID_MC);
    const result = await importFromFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("multiple-choice");
    }
  });

  it("rejects a config payload over 1 MB (measured)", async () => {
    // 2 MB string payload — well above the 1 MB measured cap.
    const file = await buildBombZip(2 * 1024 * 1024);
    const result = await importFromFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/unexpectedly large/i);
    }
  });

  it("rejects when measured bytes exceed cap even if declared size lies", async () => {
    // Simulate the classic zip-bomb: attacker edits the central directory
    // so `_data.uncompressedSize` reads as small (would slip past the old
    // declared-size-only guard), while actual decompressed bytes blow past
    // the cap. We patch JSZip.loadAsync to forge a tiny declared size on
    // the matched entry; the measured guard must still reject.
    const big = "a".repeat(2 * 1024 * 1024);
    const inner = JSON.stringify({ version: "1.0", title: "Bomb", payload: big });
    const zip = new JSZip();
    zip.file("samples/multiple-choice/basic.json", inner);
    const bytes = await zip.generateAsync({ type: "uint8array" });

    const originalLoad = JSZip.loadAsync.bind(JSZip);
    const spy = vi
      .spyOn(JSZip, "loadAsync")
      .mockImplementation(async (data: Parameters<typeof JSZip.loadAsync>[0], options?: Parameters<typeof JSZip.loadAsync>[1]) => {
        const loaded = await originalLoad(data, options);
        for (const entry of Object.values(loaded.files)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((entry as any)._data) (entry as any)._data.uncompressedSize = 100;
        }
        return loaded;
      });

    try {
      const result = await importFromFile(fakeFile(bytes, "bomb.zip"));
      // Either our measured guard fires ("unexpectedly large") OR JSZip's
      // internal size cross-check fires ("size mismatch"). Both are
      // acceptable — what matters is the bomb does NOT slip through.
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/unexpectedly large|size mismatch/i);
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("rejects a json file that isn't a known activity", async () => {
    const file = fakeFile(
      new TextEncoder().encode(JSON.stringify({ not: "an activity" })),
      "weird.json",
    );
    const result = await importFromFile(file);
    expect(result.ok).toBe(false);
  });
});
