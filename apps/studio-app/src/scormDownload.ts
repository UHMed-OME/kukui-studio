import type { ActivityKind } from "@kukui/core";
import type JSZipType from "jszip";
import { slug } from "./util/slug.js";
import { loadCachedModelBlob } from "./sketchfab/modelCache.js";
import { loadSlideAsset } from "./slides/slideAssetStore.js";

/**
 * Build a SCORM 1.2 zip in the browser by patching a pre-built template.
 *
 * The 23 templates live at /scorm-templates/kukui-<kind>.scorm.zip — those
 * were produced by `node packaging/pack-scorm.js --all` against the same
 * @kukui/core build the Studio is using. We open the template, swap in the
 * author's draft as `samples/<kind>/basic.json`, and rewrite the activity
 * title in `imsmanifest.xml` so D2L's gradebook listing matches what the
 * author entered.
 *
 * If the activity has a Sketchfab-imported model (`model.sketchfabMode ===
 * "import"`), the cached `.glb` body is bundled into the zip and
 * `model.src` is rewritten to the relative asset path so the SCORM package
 * is fully self-contained.
 */
export async function downloadScormZip(kind: ActivityKind, config: unknown): Promise<void> {
  // JSZip (~25 KB gz) only matters when the author actually clicks
  // Download. Dynamic-import to keep it out of the Studio's main chunk.
  const { default: JSZip } = await import("jszip");

  const templateUrl = `${import.meta.env.BASE_URL}scorm-templates/kukui-${kind}.scorm.zip`;
  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(`Template fetch failed (${response.status} ${response.statusText})`);
  }
  const templateBytes = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(templateBytes);

  // Rewrite Sketchfab-imported models BEFORE serialising. If a hotspot-3d
  // activity has model.sketchfabMode === "import", the cached .glb body
  // gets bundled into the zip and model.src is rewritten to point at it.
  // Then bundle any course-presentation slide images the same way (IndexedDB
  // blob → samples/<kind>/assets/<id>.png, background.src → relative path).
  const finalConfig = await embedBranchingAssets(
    kind,
    await embedSlideAssets(kind, await embedSketchfabImports(kind, config, zip), zip),
    zip,
  );

  // Swap in the author's JSON.
  const samplePath = `samples/${kind}/basic.json`;
  zip.file(samplePath, JSON.stringify(finalConfig, null, 2));

  // Patch the manifest's <title> tags to the author's title (if present).
  const manifest = await zip.file("imsmanifest.xml")?.async("string");
  if (manifest) {
    const title = (config as { title?: unknown }).title;
    if (typeof title === "string" && title.trim().length > 0) {
      const escaped = title
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      // Replacer function so `$&` / `$'` etc. in the author's title are
      // treated literally, not as String.replace substitution patterns.
      const next = manifest.replace(
        /<title>[^<]*<\/title>/g,
        () => `<title>${escaped}</title>`,
      );
      zip.file("imsmanifest.xml", next);
    }
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  // Filename mirrors what learners and instructors will see in Lamakū's
  // upload picker. Use the human title verbatim (slugified to keep
  // filesystems happy); plain `.zip` so D2L recognises it as a SCORM
  // package without the `.scorm.zip` double-extension.
  const filename = slug((config as { title?: string }).title) || kind;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * If the activity config contains a Sketchfab-imported model
 * (`model.sketchfabMode === "import"`), fetch the cached `.glb` blob from
 * IndexedDB, embed it at `samples/<kind>/assets/<uid>.glb` inside the zip,
 * and return a deep-cloned config with:
 *   - `model.src` rewritten to `./assets/<uid>.glb`
 *   - `model.sketchfabMode` removed  (the runtime GLB loader only needs `src`)
 *   - `model.sketchfabUid` + `model.attribution` preserved for credit display
 *
 * For any other activity kind or model type the config is returned unchanged.
 */
export async function embedSketchfabImports(
  kind: ActivityKind,
  config: unknown,
  zip: JSZipType,
): Promise<unknown> {
  if (!config || typeof config !== "object") return config;
  const model = (config as { model?: { sketchfabMode?: string; sketchfabUid?: string } }).model;
  if (!model || model.sketchfabMode !== "import" || !model.sketchfabUid) {
    return config;
  }
  const blob = await loadCachedModelBlob(model.sketchfabUid);
  if (!blob) {
    throw new Error(
      `Sketchfab model ${model.sketchfabUid} is referenced but not in cache. Re-import the model and try again.`,
    );
  }
  // Asset path inside the zip — colocated under the activity's samples
  // folder so the relative ./ in model.src resolves cleanly from the
  // JSON's URL at runtime.
  const assetPath = `samples/${kind}/assets/${model.sketchfabUid}.glb`;
  zip.file(assetPath, await blob.arrayBuffer());

  // Deep clone the config and rewrite the embedded JSON: set model.src
  // to the relative path, drop sketchfabMode (runtime uses src now),
  // keep sketchfabUid + attribution for the footer credit.
  const next = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
  const nextModel = next.model as Record<string, unknown>;
  nextModel.src = `./assets/${model.sketchfabUid}.glb`;
  delete nextModel.sketchfabMode;
  return next;
}

/**
 * If the config is a course-presentation deck whose slides carry image
 * backgrounds with an `assetId` (imported PDF / slide images cached in
 * IndexedDB), bundle each PNG at `samples/<kind>/assets/<assetId>.png` inside
 * the zip and rewrite that slide's `background.src` to the relative path,
 * dropping `assetId` — so the SCORM/web package renders the deck fully offline.
 *
 * Mirrors embedSketchfabImports. Backgrounds that already have an external
 * `src` and no `assetId` (e.g. https placeholders, or already-exported decks)
 * pass through untouched. For any other activity kind the config is unchanged.
 */
export async function embedSlideAssets(
  kind: ActivityKind,
  config: unknown,
  zip: JSZipType,
): Promise<unknown> {
  if (!config || typeof config !== "object") return config;
  const slides = (config as { slides?: unknown }).slides;
  if (!Array.isArray(slides)) return config;

  const next = JSON.parse(JSON.stringify(config)) as { slides: Array<Record<string, unknown>> };
  for (const slide of next.slides) {
    const bg = slide?.background as
      | { kind?: string; assetId?: string; src?: string }
      | undefined;
    if (!bg || bg.kind !== "image" || !bg.assetId) continue;
    const blob = await loadSlideAsset(bg.assetId);
    if (!blob) {
      throw new Error(
        `Slide image ${bg.assetId} is referenced but not in cache. Re-import the deck and try again.`,
      );
    }
    const assetPath = `samples/${kind}/assets/${bg.assetId}.png`;
    zip.file(assetPath, await blob.arrayBuffer());
    bg.src = `./assets/${bg.assetId}.png`;
    delete bg.assetId;
  }
  return next;
}

/** Pick a file extension from an image/video blob's MIME type (default png). */
function extFor(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/svg+xml") return "svg";
  if (type === "video/mp4") return "mp4";
  if (type === "video/webm") return "webm";
  if (type === "video/ogg") return "ogv";
  if (type === "video/quicktime") return "mov";
  return "png";
}

/**
 * If the config is a branching-scenario whose node/outcome images carry an
 * `assetId` (uploaded, cached in IndexedDB), bundle each into the zip and
 * rewrite its `src` to the relative asset path, dropping `assetId`. Mirrors
 * embedSlideAssets. For any other kind the config is unchanged.
 */
export async function embedBranchingAssets(
  kind: ActivityKind,
  config: unknown,
  zip: JSZipType,
): Promise<unknown> {
  if (!config || typeof config !== "object") return config;
  const nodes = (config as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return config;

  const next = JSON.parse(JSON.stringify(config)) as {
    nodes: Array<Record<string, unknown>>;
  };
  const embed = async (img: { assetId?: string; src?: string } | undefined) => {
    if (!img || !img.assetId) return;
    const blob = await loadSlideAsset(img.assetId);
    if (!blob) {
      throw new Error(
        `Image ${img.assetId} is referenced but not in cache. Re-add the image and try again.`,
      );
    }
    const ext = extFor(blob.type);
    const assetPath = `samples/${kind}/assets/${img.assetId}.${ext}`;
    zip.file(assetPath, await blob.arrayBuffer());
    img.src = `./assets/${img.assetId}.${ext}`;
    delete img.assetId;
  };
  for (const node of next.nodes) {
    await embed(node?.image as { assetId?: string; src?: string } | undefined);
    // Uploaded node videos embed the same way; YouTube links have no assetId
    // and pass through untouched.
    await embed(node?.video as { assetId?: string; src?: string } | undefined);
    const outcome = node?.outcome as { image?: { assetId?: string; src?: string } } | undefined;
    await embed(outcome?.image);
  }
  return next;
}
