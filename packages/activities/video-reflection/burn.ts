/**
 * Desktop-only "burn captions into the video" pass. There is no backend and
 * ffmpeg.wasm can't run well on GitHub Pages (no cross-origin isolation), so
 * we re-render the recording through a canvas — drawing each frame plus the
 * active caption cue — and re-record the canvas + the original audio with
 * MediaRecorder. This is a real-time pass (as long as the clip) and needs
 * canvas + HTMLVideoElement `captureStream`, which iOS Safari lacks — hence
 * desktop-only, behind `burnInSupported()`.
 */
import type { Cue } from "./transcribe.js";

type CaptureableVideo = HTMLVideoElement & { captureStream?: () => MediaStream };

export function burnInSupported(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    typeof HTMLVideoElement !== "undefined" &&
    typeof (HTMLVideoElement.prototype as CaptureableVideo).captureStream === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

function pickMime(): string | undefined {
  if (typeof MediaRecorder?.isTypeSupported === "function") {
    for (const m of MIME_CANDIDATES) if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

function activeCueText(cues: Cue[], t: number): string {
  for (const c of cues) if (t >= c.start && t <= c.end) return c.text;
  return "";
}

/** Draw a centered, wrapped caption with a translucent backing at the bottom. */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  w: number,
  h: number,
): void {
  if (!text) return;
  const fontSize = Math.max(18, Math.round(h * 0.05));
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const maxWidth = w * 0.86;

  // Word-wrap to fit maxWidth.
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  const lineH = fontSize * 1.3;
  const pad = fontSize * 0.4;
  const blockH = lines.length * lineH + pad * 2;
  const bottom = h - Math.round(h * 0.04);
  const top = bottom - blockH;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, top, w, blockH);

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 4;
  lines.forEach((l, i) => {
    ctx.fillText(l, w / 2, top + pad + (i + 1) * lineH);
  });
  ctx.shadowBlur = 0;
}

/**
 * Re-render `blob` with `cues` painted in, returning a new captioned video
 * Blob. `onProgress` reports 0..1 by playback position. Best-effort: throws
 * if the environment can't support the pass.
 */
export async function burnCaptions(
  blob: Blob,
  cues: Cue[],
  onProgress?: (p: number) => void,
): Promise<Blob> {
  if (!burnInSupported()) throw new Error("Burn-in isn't supported in this browser.");
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video") as CaptureableVideo;
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load the recording for captioning."));
    });
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");

    const canvasStream = canvas.captureStream(30);
    const srcStream = video.captureStream?.();
    const audioTrack = srcStream?.getAudioTracks?.()[0];
    if (audioTrack) canvasStream.addTrack(audioTrack);

    const mime = pickMime();
    const recorder = new MediaRecorder(
      canvasStream,
      mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 } : undefined,
    );
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    const finished = new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(chunks, { type: recorder.mimeType || mime || "video/webm" }));
    });

    let raf = 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, w, h);
      drawCaption(ctx, activeCueText(cues, video.currentTime), w, h);
      if (onProgress && video.duration) onProgress(Math.min(1, video.currentTime / video.duration));
      raf = requestAnimationFrame(draw);
    };

    recorder.start();
    await video.play();
    draw();
    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });
    cancelAnimationFrame(raf);
    recorder.stop();
    const out = await finished;
    for (const t of canvasStream.getTracks()) t.stop();
    onProgress?.(1);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
