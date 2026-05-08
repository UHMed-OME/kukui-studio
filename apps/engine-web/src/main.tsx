import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ActivityHost, type ActivityKind } from "@kukui/core/activity-host";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

const kind = (root.dataset.activity as ActivityKind | undefined) ?? "multiple-choice";
const params = new URLSearchParams(window.location.search);

// `?config=` accepts only same-origin relative paths to prevent SSRF / open
// redirect via crafted URLs. Anything starting with a scheme, a protocol-
// relative `//`, or an unexpected `..`-traversal is rejected back to the
// HTML's `data-config` (set per-activity at build time) or the per-kind
// default sample.
function safeConfigParam(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw; // root-relative
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null; // any scheme
  if (raw.startsWith("//")) return null; // protocol-relative
  if (raw.includes("..")) return null;
  return raw;
}
const configUrl =
  safeConfigParam(params.get("config")) ?? root.dataset.config ?? `samples/${kind}/basic.json`;

createRoot(root).render(
  <StrictMode>
    <ActivityHost kind={kind} configUrl={configUrl} />
  </StrictMode>,
);
