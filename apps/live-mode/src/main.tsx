import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initColorScheme, initTheme } from "@kukui/core";
import { App } from "./App.js";
import "./styles.css";

initTheme();
initColorScheme();

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
