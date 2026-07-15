/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Ships a worked example so "reset" is a real labeling task: an original
 * unlabeled neuron diagram (inline SVG, so public-domain / CC0, no
 * attribution) with drop targets on the actual structures. Authors replace
 * the image via the file upload widget and reposition the targets.
 */

/** Original CC0 neuron illustration with NO text labels — the learner drags
 *  the labels onto the targets. Embedded as a data URL so it is standalone. */
const NEURON_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 640" role="img" aria-label="Unlabeled diagram of a neuron">
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
</svg>`,
  );

const starter = {
  version: "1.0",
  title: "Label the Neuron",
  prompt: "Drag each label onto the correct part of the neuron.",
  image: {
    src: NEURON_IMAGE,
    alt: "Unlabeled neuron: dendrites and cell body on the left, a myelinated axon leading to terminals on the right.",
  },
  labels: [
    { id: "l1", text: "Cell body (soma)", correctTargetId: "t1" },
    { id: "l2", text: "Dendrites", correctTargetId: "t2" },
    { id: "l3", text: "Axon terminals", correctTargetId: "t3" },
  ],
  targets: [
    { id: "t1", position: { x: 0.27, y: 0.49 } },
    { id: "t2", position: { x: 0.12, y: 0.33 } },
    { id: "t3", position: { x: 0.87, y: 0.5 } },
  ],
  behaviour: { enableRetry: true },
};

export default starter;
