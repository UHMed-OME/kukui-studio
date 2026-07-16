/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Ships a worked example so "reset" is a real labeling task: a public-domain
 * UNLABELED human-skeleton diagram (Wikimedia Commons, released to the public
 * domain, no attribution required) with drop targets on major bones. Authors
 * replace the image via the file upload widget and reposition the targets.
 */
import { SKELETON_IMAGE } from "./skeletonImage.js";

const starter = {
  version: "1.0",
  title: "Label the Skeleton",
  prompt: "Drag each label onto the correct bone.",
  image: {
    src: SKELETON_IMAGE,
    alt: "Front view of an unlabeled human skeleton.",
  },
  labels: [
    { id: "l1", text: "Skull", correctTargetId: "t1" },
    { id: "l2", text: "Ribs", correctTargetId: "t2" },
    { id: "l3", text: "Pelvis", correctTargetId: "t3" },
    { id: "l4", text: "Femur", correctTargetId: "t4" },
    { id: "l5", text: "Tibia", correctTargetId: "t5" },
  ],
  targets: [
    { id: "t1", position: { x: 0.47, y: 0.08 } },
    { id: "t2", position: { x: 0.34, y: 0.25 } },
    { id: "t3", position: { x: 0.47, y: 0.45 } },
    { id: "t4", position: { x: 0.42, y: 0.62 } },
    { id: "t5", position: { x: 0.47, y: 0.84 } },
  ],
  behaviour: { enableRetry: true },
};

export default starter;
