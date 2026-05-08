import JSZip from "jszip";
import type { ActivityKind } from "@kukui/core";

/**
 * Build a SCORM 1.2 zip in the browser by patching a pre-built template.
 *
 * The 7 templates live at /scorm-templates/kukui-<kind>.scorm.zip — those
 * were produced by `node packaging/pack-scorm.js --all` against the same
 * @kukui/core build the Studio is using. We open the template, swap in the
 * author's draft as `samples/<kind>/basic.json`, and rewrite the activity
 * title in `imsmanifest.xml` so D2L's gradebook listing matches what the
 * author entered.
 */
export async function downloadScormZip(kind: ActivityKind, config: unknown): Promise<void> {
  const templateUrl = `${import.meta.env.BASE_URL}scorm-templates/kukui-${kind}.scorm.zip`;
  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(`Template fetch failed (${response.status} ${response.statusText})`);
  }
  const templateBytes = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(templateBytes);

  // Swap in the author's JSON.
  const samplePath = `samples/${kind}/basic.json`;
  zip.file(samplePath, JSON.stringify(config, null, 2));

  // Patch the manifest's <title> tags to the author's title (if present).
  const manifest = await zip.file("imsmanifest.xml")?.async("string");
  if (manifest) {
    const title = (config as { title?: unknown }).title;
    if (typeof title === "string" && title.trim().length > 0) {
      const escaped = title
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const next = manifest.replace(
        /<title>[^<]*<\/title>/g,
        `<title>${escaped}</title>`,
      );
      zip.file("imsmanifest.xml", next);
    }
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  // Filename mirrors what learners and instructors will see in Lamakū's
  // upload picker. Use the human title verbatim (slugified to keep
  // filesystems happy); plain `.zip` so D2L recognises it as a SCORM
  // package without the `.scorm.zip` double-extension.
  const slug = slugify((config as { title?: string }).title) || kind;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
