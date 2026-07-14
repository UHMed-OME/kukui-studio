/**
 * Resolve a branching-scenario config's node/outcome image `assetId`s into
 * usable `src` object URLs for preview (the Live tab and the graph editor's
 * node cards). Mirrors resolveDeckAssets.ts for course-presentation slides:
 * persisted drafts store only `assetId` (the image lives in IndexedDB, not the
 * 2 MB localStorage draft), so before the runtime Component (which reads only
 * `image.src`) can show anything, we mint fresh object URLs. The
 * `useResolvedBranching` hook owns the object-URL lifecycle and revokes them.
 *
 * Images that already carry an external `src` (https / relative export path)
 * and no `assetId` pass through untouched.
 */
import { useEffect, useState } from "react";
import { loadSlideAsset } from "./slideAssetStore.js";

type Json = Record<string, unknown>;

interface Resolved {
  config: unknown;
  /** Object URLs minted here — the caller must revoke them when done. */
  urls: string[];
}

function isObj(v: unknown): v is Json {
  return Boolean(v) && typeof v === "object";
}

function revokeAll(urls: string[]): void {
  if (typeof URL.revokeObjectURL !== "function") return;
  urls.forEach((u) => URL.revokeObjectURL(u));
}

/** Resolve one image object's assetId to an object URL, or return it unchanged. */
async function resolveImage(img: unknown, urls: string[]): Promise<unknown> {
  if (!isObj(img) || typeof img.assetId !== "string") return img;
  const blob = await loadSlideAsset(img.assetId).catch(() => null);
  if (!blob) return img; // keep any existing src as a fallback
  const url = URL.createObjectURL(blob);
  urls.push(url);
  return { ...img, src: url };
}

/**
 * Return a clone of `config` with every node image and outcome image resolved
 * to object URLs. Pure: callers revoke `urls`.
 */
export async function resolveBranchingAssets(config: unknown): Promise<Resolved> {
  const urls: string[] = [];
  if (!isObj(config) || !Array.isArray(config.nodes)) {
    return { config, urls };
  }

  const nodes = await Promise.all(
    config.nodes.map(async (node) => {
      if (!isObj(node)) return node;
      const next: Json = { ...node };
      if (isObj(node.image)) next.image = await resolveImage(node.image, urls);
      if (isObj(node.outcome) && isObj(node.outcome.image)) {
        next.outcome = { ...node.outcome, image: await resolveImage(node.outcome.image, urls) };
      }
      return next;
    }),
  );

  return { config: { ...config, nodes }, urls };
}

/**
 * Hook form: resolves `config`'s image assets and keeps the object-URL
 * lifecycle. Returns the resolved config (or the input unchanged until the
 * first resolution lands). Pass `null` to disable.
 */
export function useResolvedBranching<T>(config: T | null): T | null {
  const [resolved, setResolved] = useState<T | null>(config);

  useEffect(() => {
    if (config == null) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    let mine: string[] = [];
    void resolveBranchingAssets(config).then(({ config: next, urls }) => {
      if (cancelled) {
        revokeAll(urls);
        return;
      }
      mine = urls;
      setResolved(next as T);
    });
    return () => {
      cancelled = true;
      revokeAll(mine);
    };
  }, [config]);

  return resolved;
}
