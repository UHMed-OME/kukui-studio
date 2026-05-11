import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  // Relative base so the same Vite build can be packaged into SCORM zips that
  // D2L serves from a sub-path. Without this, `/assets/...` 404s on the LMS.
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        "multiple-choice": resolve(__dirname, "multiple-choice.html"),
        "fill-in-the-blanks": resolve(__dirname, "fill-in-the-blanks.html"),
        "drag-and-drop": resolve(__dirname, "drag-and-drop.html"),
        "question-set": resolve(__dirname, "question-set.html"),
        "hotspot-3d": resolve(__dirname, "hotspot-3d.html"),
        "hotspot-2d": resolve(__dirname, "hotspot-2d.html"),
        "virtual-tour": resolve(__dirname, "virtual-tour.html"),
        "sequence-steps": resolve(__dirname, "sequence-steps.html"),
        "matching-pairs": resolve(__dirname, "matching-pairs.html"),
        categorization: resolve(__dirname, "categorization.html"),
        "anatomy-labeling": resolve(__dirname, "anatomy-labeling.html"),
        "image-comparison-slider": resolve(__dirname, "image-comparison-slider.html"),
        "highlight-text": resolve(__dirname, "highlight-text.html"),
        flashcards: resolve(__dirname, "flashcards.html"),
        "reflection-prompt": resolve(__dirname, "reflection-prompt.html"),
        "branching-scenario": resolve(__dirname, "branching-scenario.html"),
        "image-annotation": resolve(__dirname, "image-annotation.html"),
        "concept-map": resolve(__dirname, "concept-map.html"),
        "interactive-video": resolve(__dirname, "interactive-video.html"),
        "audio-recording": resolve(__dirname, "audio-recording.html"),
        "lab-panel": resolve(__dirname, "lab-panel.html"),
        "ddx-tree": resolve(__dirname, "ddx-tree.html"),
        osce: resolve(__dirname, "osce.html"),
      },
    },
  },
});
