/**
 * On-device speech-to-text for the video reflection, via transformers.js
 * (Whisper). Everything runs in the browser: the model is fetched from the
 * HuggingFace CDN on first use and the audio never leaves the device — no
 * backend, no third-party transcription service.
 *
 * This module pulls in onnxruntime-web (large), so it must only ever be
 * reached through a dynamic `import()` behind an explicit learner action —
 * never imported eagerly by the activity Component.
 */

export type Cue = { start: number; end: number; text: string };

/** Progress info surfaced to the caller (0..1 model download, then running). */
export type TranscribeProgress =
  | { phase: "download"; progress: number }
  | { phase: "run" };

// whisper-tiny.en: ~English-only, smallest model — the safest default for
// on-device use (including lower-end iPads). Accuracy is rough on jargon,
// which is why the transcript is editable downstream.
const MODEL_ID = "Xenova/whisper-tiny.en";

// Quantization to try, in order. "q8" is small + widely supported on
// onnxruntime-web; "fp32" is unquantized (no DequantizeLinear nodes at all),
// so it's the guaranteed fallback. We deliberately avoid the default, which
// can resolve to a 4-bit (q4/MatMulNBits) variant that ORT-web fails to load
// ("Missing required scale … weight_transposed_DequantizeLinear").
const DTYPES = ["q8", "fp32"] as const;

let pipelinePromise: Promise<unknown> | null = null;

async function buildPipeline(
  onProgress?: (p: TranscribeProgress) => void,
): Promise<unknown> {
  const mod = (await import("@huggingface/transformers")) as unknown as {
    pipeline: (task: string, model: string, opts?: Record<string, unknown>) => Promise<unknown>;
    env: { allowLocalModels: boolean };
  };
  mod.env.allowLocalModels = false;
  const progress_callback = (info: { status?: string; progress?: number }) => {
    if (info?.status === "progress" && typeof info.progress === "number") {
      onProgress?.({ phase: "download", progress: info.progress / 100 });
    }
  };
  let lastError: unknown;
  for (const dtype of DTYPES) {
    try {
      return await mod.pipeline("automatic-speech-recognition", MODEL_ID, {
        dtype,
        progress_callback,
      });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not load the speech model.");
}

async function getTranscriber(
  onProgress?: (p: TranscribeProgress) => void,
): Promise<unknown> {
  if (!pipelinePromise) {
    pipelinePromise = buildPipeline(onProgress);
  }
  try {
    return await pipelinePromise;
  } catch (err) {
    // Don't cache a failed load — let "Try captions again" re-attempt.
    pipelinePromise = null;
    throw err;
  }
}

/** Decode a recorded media Blob to 16 kHz mono Float32 PCM (what Whisper wants). */
async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const arrayBuf = await blob.arrayBuffer();
  const Ctor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio is not available in this browser.");
  const tmp = new Ctor();
  let decoded: AudioBuffer;
  try {
    decoded = await tmp.decodeAudioData(arrayBuf);
  } finally {
    void tmp.close();
  }
  const targetRate = 16000;
  const frames = Math.max(1, Math.ceil(decoded.duration * targetRate));
  const offline = new OfflineAudioContext(1, frames, targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

type WhisperOutput = {
  text?: string;
  chunks?: { timestamp: [number, number | null]; text: string }[];
};

/** Transcribe a recorded Blob into timestamped caption cues. */
export async function transcribe(
  blob: Blob,
  onProgress?: (p: TranscribeProgress) => void,
): Promise<Cue[]> {
  const audio = await decodeToMono16k(blob);
  const transcriber = (await getTranscriber(onProgress)) as (
    audio: Float32Array,
    opts: Record<string, unknown>,
  ) => Promise<WhisperOutput>;
  onProgress?.({ phase: "run" });
  const out = await transcriber(audio, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  const durationSec = audio.length / 16000;
  const cues: Cue[] = (out.chunks ?? [])
    .map((c) => {
      const start = c.timestamp[0] ?? 0;
      const end = c.timestamp[1] ?? start + 2;
      return { start, end, text: (c.text ?? "").trim() };
    })
    .filter((c) => c.text.length > 0);
  if (cues.length === 0 && out.text && out.text.trim()) {
    cues.push({ start: 0, end: Math.max(2, durationSec), text: out.text.trim() });
  }
  return cues;
}

function formatTimestamp(t: number): string {
  const ms = Math.max(0, Math.round(t * 1000));
  const pad = (n: number, l = 2) => n.toString().padStart(l, "0");
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/** Serialize cues to a WebVTT document (empty/zero-length cues are dropped). */
export function cuesToVtt(cues: Cue[]): string {
  const body = cues
    .filter((c) => c.text.trim().length > 0 && c.end > c.start)
    .map(
      (c, i) =>
        `${i + 1}\n${formatTimestamp(c.start)} --> ${formatTimestamp(c.end)}\n${c.text.trim()}`,
    )
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}
