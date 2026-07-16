/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Ships a worked example so "reset" is a meaningful comparison: a normal
 * chest X-ray vs one showing pneumonia (both CC0 / public-domain by Mikael
 * Haggstrom, Wikimedia Commons), cropped to the same frame so dragging the
 * slider reveals the difference. Authors replace them via the file-upload
 * widget.
 */
// Both X-rays are CC0 (public-domain dedication) by Mikael Häggström, so no
// attribution is required; provenance is documented in the *Image.ts modules.
import { XRAY_NORMAL } from "./xrayNormalImage.js";
import { XRAY_PNEUMONIA } from "./xrayPneumoniaImage.js";

const starter = {
  version: "1.0",
  title: "Image Comparison",
  prompt: "Drag the slider to compare a normal chest X-ray with one showing pneumonia. Look for the hazy white area (consolidation) in the lungs.",
  before: {
    src: XRAY_NORMAL,
    alt: "Normal posteroanterior chest X-ray: both lungs appear evenly dark (well aerated).",
    caption: "Normal",
  },
  after: {
    src: XRAY_PNEUMONIA,
    alt: "Chest X-ray with pneumonia: a hazy white consolidation in the lower lung field.",
    caption: "Pneumonia",
  },
};

export default starter;
