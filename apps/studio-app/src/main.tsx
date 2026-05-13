import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { initColorScheme, initTheme } from "@kukui/core";
import { App } from "./App.js";
import { Landing } from "./pages/Landing.js";
import { DocsLayout } from "./pages/docs/DocsLayout.js";
import { DocsIndex } from "./pages/docs/DocsIndex.js";
import { DocPage } from "./pages/docs/DocPage.js";
import { BlogIndex } from "./pages/blog/BlogIndex.js";
import { BlogPost } from "./pages/blog/BlogPost.js";
import { Privacy } from "./pages/Privacy.js";
import { ChunkErrorBoundary, reloadBypassingCache } from "./pages/shared/ChunkErrorBoundary.js";
import "./styles.css";

initTheme();
initColorScheme();

// Recover from stale-cache chunk-load failures.
// After a Pages deploy, the user's cached index.html may still point to
// the previous build's chunk hashes (e.g. /assets/index-abc123.js) that
// no longer exist. The dynamic import throws a ChunkLoadError-style
// rejection; force a reload that bypasses the HTTP cache so the new
// index.html is fetched. A plain reload() reuses the cached `/` entry
// — which is the stale one referencing the missing chunk — so the same
// broken cycle repeats. Cache-busting via a query param sidesteps that.
// Guarded by sessionStorage so we don't loop if the chunk genuinely
// cannot be served.
window.addEventListener("vite:preloadError", (event) => {
  if (sessionStorage.getItem("kukui:chunk-reload-tried") === "1") {
    return;
  }
  sessionStorage.setItem("kukui:chunk-reload-tried", "1");
  event.preventDefault();
  reloadBypassingCache();
});

// Clear the chunk-reload flag a short moment after the app has booted,
// so a *later* deploy in the same session can still trigger a recovery
// reload. Without this, only the first chunk error in a session would
// reload; subsequent ones would silently fail.
window.setTimeout(() => {
  sessionStorage.removeItem("kukui:chunk-reload-tried");
}, 5000);

// SPA fallback: GitHub Pages' 404.html shim stashes the requested path
// in sessionStorage and redirects to "/". Before we mount the router,
// pop that path and replace history so React Router sees the original
// URL. Convention from rafgraph/spa-github-pages.
const stashedPath = sessionStorage.getItem("kukui:redirect");
if (stashedPath && stashedPath !== "/") {
  sessionStorage.removeItem("kukui:redirect");
  window.history.replaceState(null, "", stashedPath);
}

// Strip the `_kkb` cache-bust marker added by reloadBypassingCache()
// once we've successfully booted — it served its purpose at fetch time
// and shouldn't pollute the user's URL bar / bookmarks afterwards.
// Runs *after* the SPA fallback restores any stashed path, so a deep
// link that came through 404.html doesn't end up with a `_kkb` it
// inherited from the cache-busted root.
if (new URLSearchParams(window.location.search).has("_kkb")) {
  const cleaned = new URL(window.location.href);
  cleaned.searchParams.delete("_kkb");
  window.history.replaceState(null, "", cleaned.pathname + cleaned.search + cleaned.hash);
}

// Migration shim: existing bookmarks of kukuistudio.com/?activity=X
// (where X is a kind) used to load the editor directly. Route those
// to /studio?activity=X so they still work.
if (
  window.location.pathname === "/" &&
  new URLSearchParams(window.location.search).has("activity")
) {
  window.history.replaceState(null, "", "/studio" + window.location.search);
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <ChunkErrorBoundary>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/studio" element={<App />} />
          <Route path="/docs" element={<DocsLayout />}>
            <Route index element={<DocsIndex />} />
            <Route path=":slug" element={<DocPage />} />
          </Route>
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ChunkErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
