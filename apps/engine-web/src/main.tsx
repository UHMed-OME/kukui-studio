import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ActivityHost, type ActivityKind } from "@kukui/core/activity-host";
import { initColorScheme, parseCollectConfig, type DriverMode } from "@kukui/core";
import { safeConfigParam } from "./safeConfigParam.js";
import "./styles.css";

initColorScheme();

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

const kind = (root.dataset.activity as ActivityKind | undefined) ?? "multiple-choice";
const params = new URLSearchParams(window.location.search);

const configUrl =
  safeConfigParam(params.get("config")) ?? root.dataset.config ?? `samples/${kind}/basic.json`;

// Distribution mode. SCORM packages omit data-mode → undefined → silent LMS
// behaviour (pipwerks if present, else in-memory). Web packages set
// data-mode="web" to turn on localStorage persistence + the completion panel.
const mode = root.dataset.mode === "web" ? ("web" as DriverMode) : undefined;
// Results-collection wiring is only meaningful in web mode and is baked onto
// #root by the web packager / Studio; ignored otherwise.
const collect = mode === "web" ? parseCollectConfig(root.dataset.collect) : undefined;

createRoot(root).render(
  <StrictMode>
    <ActivityHost kind={kind} configUrl={configUrl} mode={mode} collect={collect} />
  </StrictMode>,
);
