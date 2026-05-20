import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { activitySamplesPlugin } from "./vite-plugin-activity-samples.js";

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
  plugins: [react(), activitySamplesPlugin(), tailwindcss(), cspMetaPlugin()],
  build: {
    rollupOptions: {
      // Auto-discover HTML entries — one per activity in apps/engine-web/.
      // Maps slug → absolute path. Replaces a previously-maintained ~26-entry
      // list; adding a new activity now just needs a sibling .html file.
      input: Object.fromEntries(
        readdirSync(__dirname)
          .filter((file) => file.endsWith(".html"))
          .map((file) => [
            file.replace(/\.html$/, ""),
            resolve(__dirname, file),
          ]),
      ),
    },
  },
});
