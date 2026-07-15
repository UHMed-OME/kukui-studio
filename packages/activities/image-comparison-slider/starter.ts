/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * The two images are original inline SVGs (public-domain / CC0, no
 * attribution required) embedded as data URLs so the starter is standalone
 * and travels into the SCORM zip + downloaded JSON without a bundled asset
 * path. They share the same scene — a healing wound at Day 1 vs Day 14 —
 * so dragging the slider reveals a meaningful before/after change. Authors
 * replace them via the file upload widget.
 */

const SKIN = "#e8c3a0";
const SKIN_SHADE = "#d9ad86";

/** Day 1: an inflamed, open wound. */
const BEFORE_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 640" role="img" aria-label="Wound at day 1: inflamed and open">
<rect width="1024" height="640" fill="${SKIN}"/>
<ellipse cx="512" cy="320" rx="360" ry="240" fill="${SKIN_SHADE}" opacity="0.5"/>
<ellipse cx="512" cy="320" rx="230" ry="150" fill="#e79a7f" opacity="0.7"/>
<path d="M400 210 L470 300 L440 340 L520 400 L500 450 L600 460" fill="none" stroke="#a11c11" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M400 210 L470 300 L440 340 L520 400 L500 450 L600 460" fill="none" stroke="#6f0f08" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
<g fill="#7a1109" opacity="0.85"><circle cx="470" cy="300" r="7"/><circle cx="520" cy="400" r="7"/><circle cx="560" cy="430" r="6"/></g>
<g transform="translate(60 560)" font-family="system-ui, sans-serif"><rect x="-16" y="-30" width="150" height="44" rx="10" fill="#000" opacity="0.55"/><text x="0" y="0" font-size="26" font-weight="700" fill="#fff">Day 1</text></g>
</svg>`,
  );

/** Day 14: the same wound, healed to a faint scar. */
const AFTER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 640" role="img" aria-label="Wound at day 14: healed to a faint scar">
<rect width="1024" height="640" fill="${SKIN}"/>
<ellipse cx="512" cy="320" rx="360" ry="240" fill="${SKIN_SHADE}" opacity="0.35"/>
<path d="M400 210 L470 300 L440 340 L520 400 L500 450 L600 460" fill="none" stroke="#c98f74" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M400 210 L470 300 L440 340 L520 400 L500 450 L600 460" fill="none" stroke="#f0d8c4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<g transform="translate(60 560)" font-family="system-ui, sans-serif"><rect x="-16" y="-30" width="160" height="44" rx="10" fill="#000" opacity="0.55"/><text x="0" y="0" font-size="26" font-weight="700" fill="#fff">Day 14</text></g>
</svg>`,
  );

const starter = {
  version: "1.0",
  title: "Image Comparison",
  prompt: "Drag the slider to compare the wound on day 1 and day 14.",
  before: {
    src: BEFORE_IMAGE,
    alt: "Wound at day 1: inflamed, open, and red",
  },
  after: {
    src: AFTER_IMAGE,
    alt: "Wound at day 14: closed and healed to a faint scar",
  },
};

export default starter;
