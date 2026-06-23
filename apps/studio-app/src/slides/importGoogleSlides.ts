/**
 * Google Slides link importer for course-presentation — best-effort, with a
 * PDF-export fallback.
 *
 * The fully-offline snapshot model needs a re-encodable image per slide. Google's
 * slide-image / export endpoints generally send no CORS headers, so a pure
 * browser fetch into a canvas is blocked (or taints the canvas, which makes
 * `toBlob` throw a SecurityError). There is no public, unauthenticated,
 * CORS-friendly per-slide image endpoint we can rely on.
 *
 * So this module's job is narrow and honest: recognize a Google Slides link and
 * extract its deck id (useful + testable), then surface a clear instruction to
 * export the deck to PDF and import that instead — the guaranteed-offline path.
 * If/when a proxy or the Slides API (with auth) is added, the snapshot can land
 * here behind the same entry point.
 */

/** Thrown when we can't snapshot a Slides deck offline; carries author guidance. */
export class GoogleSlidesUnavailableError extends Error {
  readonly deckId: string | null;
  constructor(message: string, deckId: string | null) {
    super(message);
    this.name = "GoogleSlidesUnavailableError";
    this.deckId = deckId;
  }
}

/**
 * Extract the presentation id from a Google Slides URL. Handles the common
 * shapes:
 *   https://docs.google.com/presentation/d/<ID>/edit#slide=...
 *   https://docs.google.com/presentation/d/e/<PUBID>/pub
 *   .../d/<ID>/embed?...
 * Returns null if it isn't a recognizable Slides URL.
 */
export function parseGoogleSlidesId(input: string): string | null {
  const s = input.trim();
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (!/(^|\.)docs\.google\.com$/i.test(url.hostname)) return null;
  if (!/\/presentation\//i.test(url.pathname)) return null;
  // /presentation/d/e/<pubId>/... (published) or /presentation/d/<id>/...
  const m = url.pathname.match(/\/presentation\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

/** The public embed URL for a deck id — handy for a future live-embed option. */
export function googleSlidesEmbedUrl(deckId: string): string {
  return `https://docs.google.com/presentation/d/${deckId}/embed`;
}

/**
 * Attempt to import a Google Slides deck by link. Currently always routes to the
 * PDF-export fallback (see module note) — it validates the link and throws a
 * friendly, typed error the editor renders as guidance. Never returns slides
 * yet; typed as a Promise so the call site is ready for a real snapshot later.
 */
export async function importGoogleSlides(link: string): Promise<never> {
  const deckId = parseGoogleSlidesId(link);
  if (!deckId) {
    throw new GoogleSlidesUnavailableError(
      "That doesn't look like a Google Slides link. Paste the share/edit URL, or export the deck to PDF and import the PDF.",
      null,
    );
  }
  throw new GoogleSlidesUnavailableError(
    "Google Slides can't be snapshotted directly in the browser (Google blocks cross-origin image access). " +
      "In Slides choose File → Download → PDF document, then use Import PDF here — the deck will be fully offline and accessible.",
    deckId,
  );
}
