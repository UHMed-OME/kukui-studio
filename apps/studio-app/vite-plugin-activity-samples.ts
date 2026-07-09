import { existsSync, readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIVITIES_ROOT = resolve(HERE, "..", "..", "packages", "activities");

/**
 * Maps requests for `/samples/<slug>/<...rest>` to files in
 * `packages/activities/<slug>/samples/<...rest>`. In dev, intercepts via
 * middleware; in build, emits matching files as static assets.
 *
 * This bridges the engine HTML pages (which still expect samples at the
 * `samples/...` URL path, per their data-config attributes) and the new
 * activity-co-located storage in @kukui/activities.
 */
export function activitySamplesPlugin(): Plugin {
  return {
    name: "kukui:activity-samples",

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const match = url.match(/^\/samples\/([^/]+)\/(.+?)(\?.*)?$/);
        if (!match) return next();
        const slug = match[1];
        const rest = match[2];
        if (!slug || !rest) return next();
        const fsPath = join(ACTIVITIES_ROOT, slug, "samples", rest);
        if (!existsSync(fsPath) || !statSync(fsPath).isFile()) return next();
        const ext = fsPath.split(".").pop()?.toLowerCase();
        const contentType =
          ext === "json" ? "application/json" :
          ext === "glb"  ? "model/gltf-binary" :
          ext === "svg"  ? "image/svg+xml" :
          ext === "png"  ? "image/png" :
          ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
          ext === "webp" ? "image/webp" :
          ext === "mp3"  ? "audio/mpeg" :
          ext === "vtt"  ? "text/vtt" :
          "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.end(readFileSync(fsPath));
      });
    },

    async generateBundle() {
      const slugs = await readdir(ACTIVITIES_ROOT, { withFileTypes: true });
      for (const slugEntry of slugs) {
        if (!slugEntry.isDirectory()) continue;
        const samplesDir = join(ACTIVITIES_ROOT, slugEntry.name, "samples");
        if (!existsSync(samplesDir)) continue;
        await emitTree.call(this, samplesDir, `samples/${slugEntry.name}`);
      }
    },
  };
}

async function emitTree(
  this: { emitFile: (file: { type: "asset"; fileName: string; source: Buffer }) => void },
  fsDir: string,
  outPrefix: string,
): Promise<void> {
  const entries = await readdir(fsDir, { withFileTypes: true });
  for (const entry of entries) {
    const fsPath = join(fsDir, entry.name);
    const outPath = `${outPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await emitTree.call(this, fsPath, outPath);
    } else {
      this.emitFile({
        type: "asset",
        fileName: outPath,
        source: readFileSync(fsPath),
      });
    }
  }
}
