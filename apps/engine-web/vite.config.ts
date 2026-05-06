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
        "course-presentation": resolve(__dirname, "course-presentation.html"),
        "question-set": resolve(__dirname, "question-set.html"),
        "hotspot-3d": resolve(__dirname, "hotspot-3d.html"),
        "hotspot-2d": resolve(__dirname, "hotspot-2d.html"),
        "virtual-tour": resolve(__dirname, "virtual-tour.html"),
      },
    },
  },
});
