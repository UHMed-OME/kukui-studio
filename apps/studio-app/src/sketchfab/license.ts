/**
 * Creative Commons license allow/reject rules for Sketchfab imports.
 *
 * We embed only models with licenses that permit redistribution inside a
 * SCORM package. ND (no derivatives) variants are rejected because
 * embedding into an interactive activity is arguably a derivative work.
 * Proprietary / "Standard" Sketchfab licenses have variable terms and
 * aren't safe to assume blanket redistribution rights.
 */

import type { SketchfabLicense } from "./client.js";

/** CC slugs we accept. Matches Sketchfab's `license.slug` field. */
const IMPORTABLE_SLUGS = new Set(["cc0", "by", "by-sa", "by-nc"]);

export function isImportableLicense(license: SketchfabLicense | null): boolean {
  if (!license) return false;
  return IMPORTABLE_SLUGS.has(license.slug.toLowerCase());
}

export function licenseRejectionMessage(license: SketchfabLicense | null): string {
  if (!license) {
    return "Sketchfab didn't report a license for this model. We can only embed models with a Creative Commons license that permits redistribution.";
  }
  const slug = license.slug.toLowerCase();
  if (slug.includes("nd")) {
    return `This model is licensed "${license.label}" (no derivatives). Embedding it into an interactive activity is arguably a derivative work, so we can't import it. Pick a CC-BY, CC-BY-SA, CC-BY-NC, or CC0 model instead.`;
  }
  if (slug === "st" || slug === "ed" || slug.startsWith("standard") || slug.startsWith("editorial")) {
    return `This model uses a proprietary / "${license.label}" license. We can only embed models with explicit CC license terms.`;
  }
  return `This model's license ("${license.label}") doesn't match the ones we know how to embed. Pick a CC-BY, CC-BY-SA, CC-BY-NC, or CC0 model.`;
}
