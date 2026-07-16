/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Ships one worked slide so "reset" is a working, interactive example rather
 * than a blank deck: a public-domain labeled animal-cell diagram (by
 * LadyofHats, Wikimedia Commons — released to the public domain, no
 * attribution required) carrying an info hotspot and a multiple-choice
 * checkpoint. Authors replace the deck by importing a PDF / PowerPoint /
 * Google Slides export on the Edit canvas, or swap this slide's image.
 */
import { CELL_IMAGE } from "./cellImage.js";

const starter = {
  version: "1.0",
  title: "Course Presentation",
  slides: [
    {
      id: "slide-1",
      title: "The animal cell",
      background: {
        kind: "image",
        src: CELL_IMAGE,
        alt: "Labeled diagram of an animal cell: the nucleus at the center, surrounded by mitochondria, endoplasmic reticulum, Golgi apparatus, and other organelles within the plasma membrane.",
        naturalWidth: 720,
        naturalHeight: 482,
      },
      notes:
        "<p>Click the hotspot to reveal a note, then answer the checkpoint. Replace this slide by importing your own deck (PDF / PowerPoint / Google Slides) on the Edit canvas.</p>",
      overlays: [
        {
          kind: "info",
          id: "info-1",
          rect: { x: 0.42, y: 0.31, w: 0.14, h: 0.16 },
          label: "Nucleus",
          html: "<p>The <strong>nucleus</strong> holds the cell's DNA and directs its activities. The nucleolus inside it assembles ribosomes.</p>",
        },
        {
          kind: "checkpoint",
          id: "cp-1",
          rect: { x: 0.12, y: 0.72, w: 0.24, h: 0.16 },
          required: true,
          activity: {
            kind: "multipleChoice",
            config: {
              version: "1.0",
              title: "Powerhouse of the cell",
              question: "<p>Which organelle produces most of the cell's ATP (its usable energy)?</p>",
              answers: [
                {
                  text: "Mitochondrion",
                  correct: true,
                  feedback: "Correct — the mitochondria carry out aerobic respiration to make ATP.",
                },
                {
                  text: "Golgi apparatus",
                  correct: false,
                  feedback: "Not quite — the Golgi packages and ships proteins; it does not make ATP.",
                },
                {
                  text: "Nucleus",
                  correct: false,
                  feedback: "Not quite — the nucleus stores DNA and directs the cell, but does not make ATP.",
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
