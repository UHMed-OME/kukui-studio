import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { activitySamplesPlugin } from "./vite-plugin-activity-samples.js";

/*
 * GitHub Pages serves the studio at https://<user>.github.io/<repo>/, so
 * production assets must be requested under that subpath. The build sets
 * KUKUI_BASE in CI (e.g. KUKUI_BASE=/kukui-web/), and that becomes Vite's
 * `base`. Local dev and SCORM-bundled previews still default to "./" so
 * relative paths work when the page is opened from disk or via dev server.
 */
const base = process.env.KUKUI_BASE ?? "./";

export default defineConfig({
  base,
  plugins: [react(), activitySamplesPlugin(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: false,
  },
});
