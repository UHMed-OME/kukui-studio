/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Ships a worked example so "reset" is a real annotation task: a
 * public-domain labeled neuron diagram (by LadyofHats, Wikimedia Commons —
 * released to the public domain, no attribution required) for the learner to
 * mark up. Authors replace it via the file upload widget.
 */
import { NEURON_IMAGE } from "./neuronImage.js";

const starter = {
  version: "1.0",
  title: "Annotate the Neuron",
  prompt: "Circle the myelin sheath, then draw a rectangle around a node of Ranvier.",
  image: {
    src: NEURON_IMAGE,
    alt: "Labeled diagram of a neuron: dendrites and cell body on the left, a myelinated axon with nodes of Ranvier leading to the axon terminal on the right.",
  },
  tools: { rectangle: true, circle: true, freehand: true },
  behaviour: { enableRetry: true },
};

export default starter;
