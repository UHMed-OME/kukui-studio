import { Component, type PropsWithChildren } from "react";

/**
 * Catches dynamic-import / chunk-load failures and triggers a one-shot
 * page reload. After a Pages deploy, the user's cached index.html may
 * still reference chunk hashes that no longer exist on the server; the
 * fetch fails with 404 and React.lazy throws. Vite's `vite:preloadError`
 * event handles the *preload* path, but React.lazy's runtime error path
 * doesn't always go through it — this boundary catches the rest.
 *
 * The session flag prevents reload loops if the chunk is genuinely
 * unservable (would be infinite reload otherwise).
 */

const RELOAD_FLAG = "kukui:chunk-reload-tried";

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk [\w-]+ failed/i,
  /Importing a module script failed/i,
];

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message ?? "";
  return CHUNK_ERROR_PATTERNS.some((p) => p.test(msg));
}

/**
 * Replace the current URL with a cache-busted variant so the browser
 * has to refetch `index.html`. A plain `window.location.reload()` reuses
 * the HTTP cache entry for `/`, which is exactly the stale entry that's
 * referencing the missing chunk hash — so the reload loads the same
 * broken HTML and the same broken chunk URL, forever. Appending a
 * different query string changes the cache key and forces a fresh GET.
 */
export function reloadBypassingCache(): void {
  const url = new URL(window.location.href);
  url.searchParams.set("_kkb", String(Date.now()));
  window.location.replace(url.toString());
}

interface State {
  hasError: boolean;
}

export class ChunkErrorBoundary extends Component<PropsWithChildren, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State | null {
    if (!isChunkLoadError(error)) {
      // Not a chunk error — let it propagate to a higher boundary.
      throw error;
    }
    if (sessionStorage.getItem(RELOAD_FLAG) !== "1") {
      sessionStorage.setItem(RELOAD_FLAG, "1");
      reloadBypassingCache();
    }
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      // Page is reloading; render a minimal placeholder so React doesn't
      // try to keep rendering the broken subtree in the meantime.
      return null;
    }
    return this.props.children;
  }
}
