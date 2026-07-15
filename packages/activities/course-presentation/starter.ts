/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Ships one worked slide so "reset" is a working, interactive example rather
 * than a blank deck: a labeled neuron diagram (an original inline SVG, so it
 * is public-domain / CC0 and needs no attribution) carrying an info hotspot
 * and a multiple-choice checkpoint. Authors replace the deck by importing a
 * PDF / PowerPoint / Google Slides export on the Edit canvas, or swap this
 * slide's image and edit its overlays.
 */

/** Original CC0 neuron illustration, embedded as a data URL so it travels
 *  with the config into the SCORM zip and downloaded JSON. */
const NEURON_SLIDE =
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
<text x="512" y="70" text-anchor="middle" font-family="Georgia, serif" font-size="34" font-weight="700" fill="#3f6b52">The Neuron</text>
</svg>`,
  );

const starter = {
  version: "1.0",
  title: "Course Presentation",
  slides: [
    {
      id: "slide-1",
      title: "The neuron",
      background: {
        kind: "image",
        src: NEURON_SLIDE,
        alt: "Diagram of a neuron: dendrites and cell body on the left, a myelinated axon leading to axon terminals on the right.",
        naturalWidth: 1024,
        naturalHeight: 640,
      },
      notes:
        "<p>Click the hotspot to reveal a note, then answer the checkpoint. Replace this slide by importing your own deck (PDF / PowerPoint / Google Slides) on the Edit canvas.</p>",
      overlays: [
        {
          kind: "info",
          id: "info-1",
          rect: { x: 0.5, y: 0.44, w: 0.16, h: 0.12 },
          label: "Myelin sheath",
          html: "<p>The <strong>myelin sheath</strong> insulates the axon so the signal jumps between the gaps (nodes of Ranvier) — <em>saltatory conduction</em> — making transmission far faster.</p>",
        },
        {
          kind: "checkpoint",
          id: "cp-1",
          rect: { x: 0.14, y: 0.36, w: 0.2, h: 0.16 },
          required: true,
          activity: {
            kind: "multipleChoice",
            config: {
              version: "1.0",
              title: "Direction of the signal",
              question:
                "<p>In a typical neuron, in which direction does the electrical signal travel?</p>",
              answers: [
                {
                  text: "Dendrites → cell body → axon → terminals",
                  correct: true,
                  feedback: "Correct — signals are received at the dendrites and sent out along the axon.",
                },
                {
                  text: "Axon terminals → axon → cell body → dendrites",
                  correct: false,
                  feedback: "That is the reverse — the axon carries the signal away from the cell body.",
                },
                {
                  text: "The signal travels in both directions equally",
                  correct: false,
                  feedback: "Not quite — a neuron conducts in one direction, dendrites toward terminals.",
                },
              ],
            },
          },
        },
      ],
    },
  ],
  appearance: { theme: "auto" },
};

export default starter;
