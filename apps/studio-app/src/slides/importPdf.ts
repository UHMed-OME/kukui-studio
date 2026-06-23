/**
 * Client-side PDF → slide importer for course-presentation.
 *
 * Renders each PDF page to a PNG (stored in IndexedDB via slideAssetStore) and
 * pulls the page's text layer for accessible `alt` + `notes`. Runs entirely in
 * the browser at author time — the engine never sees pdfjs; it renders the
 * pre-rasterized PNGs that get bundled into the export.
 *
 * pdfjs-dist (+ its worker) is heavy, so this module is meant to be loaded
 * dynamically (the editor `await import()`s it only when the author clicks
 * "Import PDF"). The worker is resolved through Vite's `?url` so it ships as a
 * real asset alongside the Studio build.
 */
import * as pdfjsLib from "pdfjs-dist";
// Vite resolves `?url` to the emitted worker asset URL. Static import is fine:
// this whole module is itself dynamically imported, so pdfjs stays out of the
// main chunk until an import is actually requested.
import PdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { newAssetId, putSlideAsset } from "./slideAssetStore.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl;

/** Longest edge (px) we rasterize a page to — crisp without exploding storage. */
const MAX_EDGE = 1600;

/** A slide produced by an import — shape matches the schema's Slide. */
export interface ImportedSlide {
  id: string;
  title?: string;
  background: {
    kind: "image";
    assetId: string;
    alt: string;
    naturalWidth: number;
    naturalHeight: number;
  };
  notes?: string;
  overlays: [];
}

/** Progress callback: (pagesDone, pageTotal). */
export type ImportProgress = (done: number, total: number) => void;

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))),
      "image/png",
    );
  });
}

/** Escape a plain-text run for safe insertion into the notes HTML. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Rasterize every page of `file` into slides. Each page becomes one slide with
 * an image background (PNG cached in IndexedDB) plus extracted text as `notes`
 * and a first-line `alt`. Throws if the PDF can't be parsed.
 */
export async function importPdf(
  file: File | ArrayBuffer,
  onProgress?: ImportProgress,
): Promise<ImportedSlide[]> {
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const slides: ImportedSlide[] = [];

  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, MAX_EDGE / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale: scale > 0 ? scale : 1 });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2D canvas context unavailable");
      // White matte so transparent PDFs don't render on a black background.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      const blob = await canvasToBlob(canvas);
      const assetId = newAssetId();
      await putSlideAsset(assetId, blob);

      // Text layer → accessible notes + alt. Many decks are image-only; fall
      // back to a generic page label so alt is never empty (schema requires it).
      let text = "";
      try {
        const content = await page.getTextContent();
        text = content.items
          .map((it) => ("str" in it ? it.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
      } catch {
        /* text layer optional */
      }
      const alt = text ? text.slice(0, 140) : `Slide ${pageNo}`;

      slides.push({
        id: `slide-${assetId}`,
        background: {
          kind: "image",
          assetId,
          alt,
          naturalWidth: canvas.width,
          naturalHeight: canvas.height,
        },
        ...(text ? { notes: `<p>${escapeHtml(text)}</p>` } : {}),
        overlays: [],
      });

      page.cleanup();
      onProgress?.(pageNo, pdf.numPages);
    }
  } finally {
    await loadingTask.destroy();
  }

  return slides;
}
