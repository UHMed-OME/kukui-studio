/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Ships with a real CC0 kukui (candlenut) photo so the activity shows a
 * working example the moment it loads or resets, rather than an empty
 * placeholder. The image is inlined (see kukuiStarterImage.ts) so it renders
 * in Studio, engine-web, and SCORM zips alike. Authors replace the image and
 * hotspots with their own.
 */

import { KUKUI_STARTER_IMAGE } from "./kukuiStarterImage.js";

const starter = {
  version: "1.0",
  title: "Identify the kukui nut",
  prompt:
    "This is a kukui (candlenut) tree. Click one of the developing nuts, the round fuzzy fruits on the branch.",
  image: {
    src: KUKUI_STARTER_IMAGE,
    alt: "A kukui (candlenut) tree branch with three round, fuzzy developing fruits among broad green leaves.",
    attribution: {
      author: "Philipola",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Kukui_(Candlenut).jpg",
      license: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
  },
  hotspots: [
    {
      id: "nut-upper",
      label: "Developing kukui nut",
      rect: { x: 0.2, y: 0.28, w: 0.18, h: 0.22 },
      correct: true,
      feedback: "Correct. That is a developing kukui nut, still in its fuzzy green husk.",
    },
    {
      id: "nut-center",
      label: "Developing kukui nut",
      rect: { x: 0.37, y: 0.41, w: 0.18, h: 0.19 },
      correct: true,
      feedback: "Correct. Inside this husk are the hard shell and the oily kukui seed.",
    },
    {
      id: "leaf",
      label: "Kukui leaf",
      rect: { x: 0.72, y: 0.4, w: 0.24, h: 0.18 },
      correct: false,
      feedback:
        "That is a kukui leaf, not the fruit. Look for the round fuzzy nuts on the branch.",
    },
  ],
  behaviour: { enableRetry: true, showHotspotMarkers: true },
};

export default starter;
