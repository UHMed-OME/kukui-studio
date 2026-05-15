/**
 * One-shot Sketchfab model import: URL/UID → metadata → license check →
 * download URL → blob fetch → IndexedDB cache. Returns a tagged result
 * so the UI layer can render success or a specific rejection message.
 *
 * Composes the lower-level helpers from client.ts, license.ts, and
 * modelCache.ts.
 */

import {
  extractModelUid,
  fetchModelDownloadUrls,
  fetchModelMetadata,
  type SketchfabModelMetadata,
} from "./client.js";
import { isImportableLicense, licenseRejectionMessage } from "./license.js";
import { cacheModelBlob } from "./modelCache.js";

export type ImportAttribution = {
  author: string;
  authorUrl?: string;
  sourceUrl?: string;
  license?: string;
  licenseUrl?: string;
};

export type ImportOk = {
  kind: "ok";
  uid: string;
  metadata: SketchfabModelMetadata;
  attribution: ImportAttribution;
};

export type ImportError = {
  kind: "error";
  message: string;
};

export type ImportResult = ImportOk | ImportError;

export async function importFromSketchfab(
  urlOrUid: string,
  accessToken: string,
): Promise<ImportResult> {
  const uid = extractModelUid(urlOrUid);
  if (!uid) {
    return { kind: "error", message: "That doesn't look like a Sketchfab URL or UID." };
  }

  let metadata: SketchfabModelMetadata;
  try {
    metadata = await fetchModelMetadata(uid, accessToken);
  } catch (err) {
    return { kind: "error", message: (err as Error).message };
  }

  if (!metadata.isDownloadable) {
    return {
      kind: "error",
      message: "This Sketchfab model isn't downloadable. Ask the author to enable downloads, or pick a different model.",
    };
  }

  if (!isImportableLicense(metadata.license)) {
    return { kind: "error", message: licenseRejectionMessage(metadata.license) };
  }

  let urls: { glb?: string; gltf?: string };
  try {
    urls = await fetchModelDownloadUrls(uid, accessToken);
  } catch (err) {
    return { kind: "error", message: (err as Error).message };
  }

  if (!urls.glb) {
    return {
      kind: "error",
      message: "Sketchfab didn't return a GLB download URL for this model. Pick a model that has GLB available.",
    };
  }

  let blob: Blob;
  try {
    const res = await fetch(urls.glb);
    if (!res.ok) {
      return {
        kind: "error",
        message: `Downloading the model body failed: ${res.status} ${res.statusText}`,
      };
    }
    blob = await res.blob();
  } catch (err) {
    return { kind: "error", message: (err as Error).message };
  }

  await cacheModelBlob(uid, blob);

  const attribution: ImportAttribution = {
    author: metadata.author.username,
    authorUrl: metadata.author.profileUrl || undefined,
    sourceUrl: metadata.viewerUrl || undefined,
    license: metadata.license?.label,
    licenseUrl: metadata.license?.url,
  };

  return { kind: "ok", uid, metadata, attribution };
}
