/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Ships a worked example so "reset" is a real annotation task: an original
 * labeled neuron diagram (inline SVG, so public-domain / CC0, no attribution)
 * for the learner to mark up. Authors replace it via the file upload widget.
 */

/** Original CC0 neuron illustration, embedded as a data URL. */
const NEURON_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 640" role="img" aria-label="Labeled diagram of a neuron">
<rect width="1024" height="640" fill="#fbfaf6"/>
<g stroke="#4a7a5f" stroke-width="6" fill="none" stroke-linecap="round">
<path d="M232 300 L150 220"/><path d="M232 300 L140 300"/><path d="M232 300 L160 380"/><path d="M240 350 L180 430"/><path d="M270 250 L230 160"/>
<path d="M150 220 L120 190"/><path d="M150 220 L130 250"/><path d="M140 300 L108 285"/><path d="M160 380 L128 400"/>
</g>
<line x1="300" y1="320" x2="820" y2="320" stroke="#3f6b52" stroke-width="16" stroke-linecap="round"/>
<g fill="#c9e2d4" stroke="#3f6b52" stroke-width="3">
<ellipse cx="430" cy="320" rx="46" ry="26"/><ellipse cx="560" cy="320" rx="46" ry="26"/><ellipse cx="690" cy="320" rx="46" ry="26"/>
</g>
<g stroke="#3f6b52" stroke-width="7" fill="none" stroke-linecap="round">
<path d="M820 320 L880 280"/><path d="M820 320 L890 320"/><path d="M820 320 L880 360"/><path d="M880 280 L910 260"/><path d="M880 360 L910 380"/>
</g>
<circle cx="272" cy="316" r="70" fill="#4a7a5f"/>
<circle cx="255" cy="300" r="26" fill="#2f5140"/>
<g font-family="system-ui, sans-serif" fill="#1c1e20">
<text x="252" y="470" text-anchor="middle" font-size="22" font-weight="700">Cell body (soma)</text>
<text x="120" y="150" text-anchor="middle" font-size="20">Dendrites</text>
<text x="560" y="235" text-anchor="middle" font-size="20">Myelin sheath</text>
<text x="895" y="440" text-anchor="middle" font-size="20">Axon terminals</text>
</g>
</svg>`,
  );

const starter = {
  version: "1.0",
  title: "Annotate the Neuron",
  prompt: "Circle the myelin sheath, then draw a rectangle around the axon terminals.",
  image: {
    src: NEURON_IMAGE,
    alt: "Labeled neuron: dendrites and cell body on the left, a myelinated axon leading to terminals on the right.",
  },
  tools: { rectangle: true, circle: true, freehand: true },
  behaviour: { enableRetry: true },
};

export default starter;
