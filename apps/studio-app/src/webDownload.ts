import type { ActivityKind } from "@kukui/core";
import type { CollectConfig } from "@kukui/core";
import { slug } from "./util/slug.js";
import { embedSketchfabImports } from "./scormDownload.js";

/**
 * Build a non-LMS "web" package in the browser by patching a pre-built
 * template — the exact mirror of `scormDownload.ts`, but for the web target.
 *
 * The templates live at /web-templates/kukui-<kind>.web.zip, produced by
 * `node packaging/pack-scorm.js --all --target web` against the same
 * @kukui/core build Studio runs. Each already carries `data-mode="web"` on
 * #root (→ LocalDriver persistence + completion panel), no imsmanifest.xml,
 * and no pipwerks. We swap in the author's draft as the activity JSON,
 * optionally bake a `data-collect` results-collection config, and retitle the
 * browser tab — then hand back a `<title>.web.zip` ready to unzip onto any
 * static host. See apps/studio-app/src/content/docs/host-on-the-web.md
 * (the "Host on the web" page in Studio's Docs).
 */
export async function downloadWebZip(
  kind: ActivityKind,
  config: unknown,
  collect?: CollectConfig,
): Promise<void> {
  const { default: JSZip } = await import("jszip");

  const templateUrl = `${import.meta.env.BASE_URL}web-templates/kukui-${kind}.web.zip`;
  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(`Template fetch failed (${response.status} ${response.statusText})`);
  }
  const zip = await JSZip.loadAsync(await response.arrayBuffer());

  // Same Sketchfab-import embedding as the SCORM path: a hotspot-3d model
  // imported into IndexedDB is bundled and model.src rewritten to a relative
  // asset, so the package is self-contained.
  const finalConfig = await embedSketchfabImports(kind, config, zip);

  zip.file(`samples/${kind}/basic.json`, JSON.stringify(finalConfig, null, 2));

  // Patch index.html: retitle the tab and, if the author configured results
  // collection, add a data-collect attribute to #root for the engine to read.
  const indexHtml = await zip.file("index.html")?.async("string");
  if (indexHtml) {
    let next = indexHtml;
    const title = (config as { title?: unknown }).title;
    if (typeof title === "string" && title.trim().length > 0) {
      const escaped = escapeHtml(title);
      // Replacer function so `$&` / `$'` etc. in the author's title are
      // treated literally, not as String.replace substitution patterns.
      next = next.replace(/<title>[^<]*<\/title>/i, () => `<title>${escaped}</title>`);
    }
    const collectConfig = sanitizeCollect(collect);
    if (collectConfig) {
      const attr = ` data-collect="${escapeAttr(JSON.stringify(collectConfig))}"`;
      // Insert right after data-mode="web" so the attribute order stays
      // predictable and we don't double-add if one already exists. The
      // replacer function keeps `$`-patterns in the collect JSON literal.
      next = next
        .replace(/\s+data-collect="[^"]*"/i, "")
        .replace(/data-mode="web"/i, (m) => `${m}${attr}`);
    }
    zip.file("index.html", next);
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const filename = slug((config as { title?: string }).title) || kind;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.web.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Drop empty/invalid channels so we never bake a meaningless data-collect. */
function sanitizeCollect(collect?: CollectConfig): CollectConfig | undefined {
  if (!collect) return undefined;
  const out: CollectConfig = {};
  if (collect.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(collect.email)) out.email = collect.email;
  if (collect.webhook && /^https:\/\//i.test(collect.webhook)) out.webhook = collect.webhook;
  if (collect.formUrl && /^https:\/\//i.test(collect.formUrl)) out.formUrl = collect.formUrl;
  return out.email || out.webhook || out.formUrl ? out : undefined;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
