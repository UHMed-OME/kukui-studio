import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

/**
 * Inject a tight Content-Security-Policy <meta> tag into every engine-web
 * HTML entry. Engine-web ships static activity HTML inside SCORM zips —
 * no AI Assist, no user-typed external URLs, just JSON loading from
 * same-origin and LMS post-back. Tight policy is tractable here, unlike
 * studio-app where the user supplies an AI base URL at runtime.
 *
 * Notes on the policy:
 * - `frame-ancestors *` is required because the LMS embeds the engine
 *   via iframe (D2L, Canvas, Moodle each on different hosts).
 * - `img-src` / `media-src` allow `https:` because authored content can
 *   reference external media (placeholder URLs, hotspot images, glb 3D
 *   models from the Khronos sample assets, etc.).
 * - `style-src 'unsafe-inline'` is required because activity components
 *   use React inline styles plus Tailwind's runtime-injected styles.
 * - `script-src 'self'` is the strict one — no external scripts at all.
 */
const CSP_CONTENT =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "connect-src 'self'; " +
  "img-src 'self' data: https:; " +
  "media-src 'self' data: https:; " +
  "style-src 'self' 'unsafe-inline'; " +
  "font-src 'self' data:; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "frame-ancestors *;";

const cspMetaPlugin = (): Plugin => ({
  name: "kukui-engine-csp-meta",
  transformIndexHtml: {
    order: "pre",
    handler(html) {
      // Skip if a CSP meta is already present (defensive — none of the
      // current entry files have one, but this keeps the plugin idempotent
      // if someone adds one by hand).
      if (/http-equiv=["']Content-Security-Policy["']/i.test(html)) {
        return html;
      }
      const tag = `    <meta http-equiv="Content-Security-Policy" content="${CSP_CONTENT}" />`;
      // Insert immediately after the charset meta so it sits high in <head>
      // before any <link>/<script>. Fall back to inserting after <head>
      // open tag if the charset meta isn't found.
      if (/<meta charset=["']UTF-8["']\s*\/>/i.test(html)) {
        return html.replace(
          /(<meta charset=["']UTF-8["']\s*\/>)/i,
          `$1\n${tag}`,
        );
      }
      return html.replace(/<head>/i, `<head>\n${tag}`);
    },
  },
});

export default defineConfig({
  // Relative base so the same Vite build can be packaged into SCORM zips that
  // D2L serves from a sub-path. Without this, `/assets/...` 404s on the LMS.
  base: "./",
  plugins: [react(), tailwindcss(), cspMetaPlugin()],
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
        crossword: resolve(__dirname, "crossword.html"),
        "straw-poll": resolve(__dirname, "straw-poll.html"),
      },
    },
  },
});
