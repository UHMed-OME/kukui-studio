/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Ships a worked example so "reset" is a real matching task: a public-domain
 * lateral brain diagram with color-coded lobes (Wikimedia Commons, released
 * to the public domain, no attribution required) and drop zones over each
 * lobe. Authors swap the background via Studio's file-upload widget and
 * reposition the zones.
 */
import { BRAIN_IMAGE } from "./brainImage.js";

const starter = {
  version: "1.0",
  title: "Label the Brain Lobes",
  prompt: "Drag each lobe name onto the matching region of the brain, then tap Check. (The brain faces left.)",
  background: {
    src: BRAIN_IMAGE,
    alt: "Lateral view of the brain with four color-coded lobes and the cerebellum; the front of the brain faces left.",
  },
  draggables: [
    { id: "d1", label: "Frontal lobe", correctZones: ["z1"] },
    { id: "d2", label: "Parietal lobe", correctZones: ["z2"] },
    { id: "d3", label: "Temporal lobe", correctZones: ["z3"] },
    { id: "d4", label: "Occipital lobe", correctZones: ["z4"] },
    { id: "d5", label: "Cerebellum", correctZones: ["z5"] },
  ],
  dropZones: [
    { id: "z1", label: "", rect: { x: 0.12, y: 0.33, w: 0.22, h: 0.24 } },
    { id: "z2", label: "", rect: { x: 0.56, y: 0.14, w: 0.22, h: 0.24 } },
    { id: "z3", label: "", rect: { x: 0.46, y: 0.54, w: 0.22, h: 0.22 } },
    { id: "z4", label: "", rect: { x: 0.78, y: 0.42, w: 0.18, h: 0.24 } },
    { id: "z5", label: "", rect: { x: 0.62, y: 0.72, w: 0.2, h: 0.22 } },
  ],
  behaviour: { enableRetry: true },
};

export default starter;
