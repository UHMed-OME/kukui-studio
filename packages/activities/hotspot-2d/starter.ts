/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted from apps/studio-app/src/starters.ts. The PLACEHOLDER_IMAGE
 * constant from that file (an inline SVG data URL used as a swap-in
 * placeholder until the author uploads or links a real image) is inlined
 * here as a local constant so this module is standalone.
 */

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 640" role="img" aria-label="Image placeholder"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4ede2"/><stop offset="1" stop-color="#e9dec9"/></linearGradient><pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r="1.5" fill="#bbae9a" opacity="0.45"/></pattern></defs><rect width="1024" height="640" fill="url(#bg)"/><rect width="1024" height="640" fill="url(#dots)"/><g transform="translate(512 280)" fill="#7b4324" opacity="0.18"><ellipse cx="0" cy="10" rx="90" ry="80"/><ellipse cx="0" cy="10" rx="70" ry="60" fill="#f4ede2"/></g><g transform="translate(512 420)" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" fill="#7b4324"><text x="0" y="0" font-size="22" font-weight="600" opacity="0.85">Replace this with your image</text><text x="0" y="32" font-size="14" opacity="0.6">Or delete it — image is optional</text></g></svg>`,
  );

const starter = {
  version: "1.0",
  title: "Image Hotspot",
  prompt: "Click the correct region.",
  image: {
    src: PLACEHOLDER_IMAGE,
    alt: "Replace with the image authors will mark up",
  },
  hotspots: [
    {
      id: "h1",
      label: "Region A",
      rect: { x: 0.2, y: 0.3, w: 0.2, h: 0.2 },
      correct: true,
    },
    {
      id: "h2",
      label: "Region B",
      rect: { x: 0.6, y: 0.3, w: 0.2, h: 0.2 },
      correct: false,
    },
  ],
  behaviour: { enableRetry: true, showHotspotMarkers: true },
};

export default starter;
