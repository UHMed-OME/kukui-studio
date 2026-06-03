#!/usr/bin/env node
/**
 * fetch-whisper-assets.mjs
 *
 * Downloads the on-device speech model into apps/engine-web/public/whisper/
 * so the video-reflection activity can transcribe **offline, same-origin**
 * inside a SCORM package — the engine CSP is `connect-src 'self'`, which
 * blocks the HuggingFace CDN the model would otherwise come from.
 *
 *   whisper/models/Xenova/whisper-tiny.en/   ← q8 model (config + tokenizer + onnx)
 *
 * The onnxruntime-web WASM is NOT staged here: Vite already bundles the exact
 * wasm its ORT build references into the engine's assets/ (same-origin, so it
 * loads fine under the CSP). pack-scorm keeps that wasm + this model only in
 * the video-reflection package; the hosted Studio build uses the CDN instead
 * (looser CSP) and never ships these bytes.
 *
 * The model is gitignored. Idempotent: skips cached files (--force to re-fetch).
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile, stat } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT = join(REPO_ROOT, "apps", "engine-web", "public", "whisper");
const FORCE = process.argv.includes("--force");

const MODEL_REPO = "Xenova/whisper-tiny.en";
const HF_BASE = `https://huggingface.co/${MODEL_REPO}/resolve/main`;
const MODEL_FILES = [
  "config.json",
  "generation_config.json",
  "preprocessor_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
];

async function fileOk(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function downloadModel() {
  const modelDir = join(OUT, "models", MODEL_REPO);
  for (const rel of MODEL_FILES) {
    const dest = join(modelDir, rel);
    if (!FORCE && (await fileOk(dest))) {
      console.log(`[whisper] skip ${rel} (cached)`);
      continue;
    }
    await mkdir(dirname(dest), { recursive: true });
    const url = `${HF_BASE}/${rel}`;
    process.stdout.write(`[whisper] download ${rel} … `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    console.log(`${(buf.length / 1024 / 1024).toFixed(1)} MB`);
  }
}

await mkdir(OUT, { recursive: true });
try {
  await downloadModel();
  console.log(`[whisper] model ready at ${OUT}`);
} catch (err) {
  // Don't fail the whole build (which gates the Studio + Live deploy) on a
  // transient HuggingFace hiccup. The video-reflection package would then
  // ship without the model and surface a graceful "couldn't load" at runtime.
  console.warn(
    `[whisper] WARNING: could not stage the model — captions will be unavailable ` +
      `in the SCORM build until the next successful fetch.\n  ${err?.message ?? err}`,
  );
}
