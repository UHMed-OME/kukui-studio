import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { initTheme } from "@kukui/core";
import { App } from "./App.js";
import { Landing } from "./pages/Landing.js";
import "./styles.css";

initTheme();

// SPA fallback: GitHub Pages' 404.html shim stashes the requested path
// in sessionStorage and redirects to "/". Before we mount the router,
// pop that path and replace history so React Router sees the original
// URL. Convention from rafgraph/spa-github-pages.
const stashedPath = sessionStorage.getItem("kukui:redirect");
if (stashedPath && stashedPath !== "/") {
  sessionStorage.removeItem("kukui:redirect");
  window.history.replaceState(null, "", stashedPath);
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
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/studio" element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
