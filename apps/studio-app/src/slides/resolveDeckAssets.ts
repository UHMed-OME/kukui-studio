/**
 * Resolve a course-presentation deck's slide-image `assetId`s into usable
 * `src` URLs for preview (the Edit canvas and the Live tab).
 *
 * Persisted drafts store only `assetId` (the PNG lives in IndexedDB, not in the
 * 2 MB localStorage draft). Before the runtime Component — which only reads
 * `background.src` — can show anything, we load each blob and mint a fresh
 * object URL. Object URLs die on reload and leak if not revoked, so the
 * `useResolvedDeck` hook owns their lifecycle and revokes on change/unmount.
 *
 * Backgrounds that already carry an external `src` (https / relative export
 * path) and no `assetId` pass through untouched.
 */
import { useEffect, useState } from "react";
import { loadSlideAsset } from "./slideAssetStore.js";

type Json = Record<string, unknown>;

interface ResolvedDeck {
  config: unknown;
  /** Object URLs minted here — the caller must revoke them when done. */
  urls: string[];
}

function isObj(v: unknown): v is Json {
  return Boolean(v) && typeof v === "object";
}

/** Revoke object URLs, tolerant of environments (jsdom) without the API. */
function revokeAll(urls: string[]): void {
  if (typeof URL.revokeObjectURL !== "function") return;
  urls.forEach((u) => URL.revokeObjectURL(u));
}

/**
 * Return a deep-ish clone of `config` with every image background's `src`
 * pointing at a fresh object URL loaded from IndexedDB (when an `assetId` is
 * present and cached). Pure: callers revoke `urls`.
 */
export async function resolveDeckAssets(config: unknown): Promise<ResolvedDeck> {
  const urls: string[] = [];
  if (!isObj(config) || !Array.isArray(config.slides)) {
    return { config, urls };
  }

  const slides = await Promise.all(
    config.slides.map(async (slide) => {
      if (!isObj(slide) || !isObj(slide.background)) return slide;
      const bg = slide.background;
      if (bg.kind !== "image" || typeof bg.assetId !== "string") return slide;
      const blob = await loadSlideAsset(bg.assetId).catch(() => null);
      if (!blob) return slide; // keep existing src (if any) as a fallback
      const url = URL.createObjectURL(blob);
      urls.push(url);
      return { ...slide, background: { ...bg, src: url } };
    }),
  );

  return { config: { ...config, slides }, urls };
}

/**
 * Hook form: resolves `config`'s slide assets and keeps the object-URL
 * lifecycle. Returns the resolved config (or the input unchanged until the
 * first resolution lands). Pass `null` to disable.
 */
export function useResolvedDeck<T>(config: T | null): T | null {
  const [resolved, setResolved] = useState<T | null>(config);

  useEffect(() => {
    if (config == null) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    let mine: string[] = [];
    void resolveDeckAssets(config).then(({ config: next, urls }) => {
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
