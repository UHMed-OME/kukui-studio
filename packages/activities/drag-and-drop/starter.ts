/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Ships a worked example so "reset" is a real matching task: an original
 * ECG trace (inline SVG, so public-domain / CC0, no attribution) with drop
 * zones over the P wave, QRS complex, and T wave. Authors swap the
 * background via Studio's file-upload widget and reposition the zones.
 */
const ECG_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 400" role="img" aria-label="A single ECG beat showing the P wave, QRS complex, and T wave">
<rect width="1024" height="400" fill="#fbfaf6"/>
<g stroke="#e7d9c6" stroke-width="1"><path d="M0 80H1024M0 160H1024M0 240H1024M0 320H1024" fill="none"/><path d="M128 0V400M256 0V400M384 0V400M512 0V400M640 0V400M768 0V400M896 0V400" fill="none"/></g>
<path d="M40 220 L200 220 Q235 178 270 220 L360 220 L384 236 L416 96 L448 250 L480 220 L580 220 Q670 158 760 220 L984 220" fill="none" stroke="#a11c11" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  );

const starter = {
  version: "1.0",
  title: "Label the ECG",
  prompt: "Drag each label onto the matching part of the ECG trace, then tap Check.",
  background: {
    src: ECG_IMAGE,
    alt: "A single ECG beat: a small P wave, a tall narrow QRS complex, then a rounded T wave.",
  },
  draggables: [
    { id: "d1", label: "P wave", correctZones: ["z1"] },
    { id: "d2", label: "QRS complex", correctZones: ["z2"] },
    { id: "d3", label: "T wave", correctZones: ["z3"] },
  ],
  dropZones: [
    { id: "z1", label: "", rect: { x: 0.19, y: 0.4, w: 0.12, h: 0.32 } },
    { id: "z2", label: "", rect: { x: 0.36, y: 0.16, w: 0.12, h: 0.6 } },
    { id: "z3", label: "", rect: { x: 0.55, y: 0.36, w: 0.18, h: 0.34 } },
  ],
  behaviour: { enableRetry: true },
};

export default starter;
