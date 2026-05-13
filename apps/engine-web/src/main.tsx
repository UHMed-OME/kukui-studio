import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ActivityHost, type ActivityKind } from "@kukui/core/activity-host";
import { initColorScheme } from "@kukui/core";
import { safeConfigParam } from "./safeConfigParam.js";
import "./styles.css";

initColorScheme();

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

const kind = (root.dataset.activity as ActivityKind | undefined) ?? "multiple-choice";
const params = new URLSearchParams(window.location.search);

const configUrl =
  safeConfigParam(params.get("config")) ?? root.dataset.config ?? `samples/${kind}/basic.json`;

createRoot(root).render(
  <StrictMode>
    <ActivityHost kind={kind} configUrl={configUrl} />
  </StrictMode>,
);
