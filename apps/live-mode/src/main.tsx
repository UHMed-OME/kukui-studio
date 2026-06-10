import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getScormDriver, initColorScheme, initTheme } from "@kukui/core";
import { App } from "./App.js";
import "./styles.css";

initTheme();
initColorScheme();

// One SCORM session per tab, not per room. The core driver is a per-page
// singleton, so initializing/finishing it inside LiveHost meant the second
// room joined in the same tab reused an already-finished driver and its
// writes were lost. `pagehide` is the most reliable end-of-session signal
// across browsers (fires on tab close, navigation, and bfcache entry);
// `once` guards a double-finish on bfcache round-trips.
const scormDriver = getScormDriver();
scormDriver.initialize();
window.addEventListener(
  "pagehide",
  () => {
    scormDriver.finish();
  },
  { once: true },
);

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
