/**
 * Minimal valid config used as Studio's "new activity" template.
 * Extracted from apps/studio-app/src/starters.ts.
 *
 * The `background.src` is the shared `PLACEHOLDER_IMAGE` data-URL from
 * the original starters file — inlined here so this module is standalone.
 * Authors swap it via Studio's file-upload widget.
 */
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 640" role="img" aria-label="Image placeholder"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4ede2"/><stop offset="1" stop-color="#e9dec9"/></linearGradient><pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r="1.5" fill="#bbae9a" opacity="0.45"/></pattern></defs><rect width="1024" height="640" fill="url(#bg)"/><rect width="1024" height="640" fill="url(#dots)"/><g transform="translate(512 280)" fill="#7b4324" opacity="0.18"><ellipse cx="0" cy="10" rx="90" ry="80"/><ellipse cx="0" cy="10" rx="70" ry="60" fill="#f4ede2"/></g><g transform="translate(512 420)" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" fill="#7b4324"><text x="0" y="0" font-size="22" font-weight="600" opacity="0.85">Replace this with your image</text><text x="0" y="32" font-size="14" opacity="0.6">Or delete it — image is optional</text></g></svg>`,
  );

const starter = {
  version: "1.0",
  title: "Drag and Drop",
  prompt: "Drag each label to its matching drop zone, then tap Check to score your answers.",
  background: {
    src: PLACEHOLDER_IMAGE,
    alt: "Replace this placeholder with a description of your background image",
  },
  draggables: [{ id: "d1", label: "Label A", correctZones: ["z1"] }],
  dropZones: [{ id: "z1", label: "Zone 1", rect: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 } }],
  behaviour: { enableRetry: true },
};

export default starter;
