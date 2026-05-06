import { useEffect, useMemo, useState } from "react";
import { type ActivityKind } from "@kukui/core";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import { EditorForm } from "./EditorForm.js";
import { JsonEditor } from "./JsonEditor.js";
import { Preview, type PreviewMode } from "./Preview.js";
import { ACTIVITY_LABELS, STARTERS } from "./starters.js";
import { clearDraft, debouncedSaver, loadDraft, saveDraft } from "./drafts.js";
import { downloadScormZip } from "./scormDownload.js";

type Tab = "form" | "json";

/**
 * Activities Kukui Studio is positioned to author.
 *
 * Quizzing (Multiple Choice, Fill in the Blanks, Question Set) overlaps
 * heavily with D2L's native quiz tooling — authors should use the LMS for
 * those. Studio focuses on activity surfaces D2L can't do natively or does
 * poorly: spatial drag-and-drop, slide presentations with custom layout,
 * 3D hotspots, and walkable scenes. Group / synchronous activities are
 * the Phase 3 (Kukui Live) story.
 *
 * The schemas and components for the quiz activities still live in
 * @kukui/core — they're built, tested, and ship in engine-web's SCORM
 * zips for anyone who wants them — Studio just doesn't promote them as
 * authoring targets.
 */
const STUDIO_ACTIVITIES: readonly ActivityKind[] = [
  "drag-and-drop",
  "course-presentation",
  "hotspot-3d",
  "virtual-tour",
] as const;

export function App() {
  const [kind, setKind] = useState<ActivityKind>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("activity");
    if (fromUrl && STUDIO_ACTIVITIES.includes(fromUrl as ActivityKind)) {
      return fromUrl as ActivityKind;
    }
    return "drag-and-drop";
  });
  const [value, setValue] = useState<unknown>(() => loadDraft(kind) ?? STARTERS[kind]);
  const [tab, setTab] = useState<Tab>("form");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("live");
  const [toast, setToast] = useState<string | null>(null);

  // Keep ?activity= in sync so refreshes preserve choice.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("activity", kind);
    window.history.replaceState(null, "", url.toString());
  }, [kind]);

  // Hydrate from draft when kind changes.
  useEffect(() => {
    setValue(loadDraft(kind) ?? STARTERS[kind]);
  }, [kind]);

  // Debounced auto-save per kind.
  const save = useMemo(() => debouncedSaver(kind), [kind]);
  useEffect(() => {
    save(value);
  }, [value, save]);

  const validation = useMemo(
    () => SchemaRegistry[kind as SchemaRegistryKey].safeParse(value),
    [kind, value],
  );

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const downloadJson = () => {
    if (!validation.success) {
      flash("Fix the highlighted validation errors first.");
      return;
    }
    const blob = new Blob([JSON.stringify(validation.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash("Downloaded.");
  };

  const copyJson = async () => {
    if (!validation.success) {
      flash("Fix the highlighted validation errors first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(validation.data, null, 2));
      flash("Copied to clipboard.");
    } catch {
      flash("Clipboard write failed.");
    }
  };

  const reset = () => {
    if (!confirm("Reset to a fresh starter? Your draft for this activity will be deleted.")) return;
    clearDraft(kind);
    setValue(STARTERS[kind]);
    flash("Reset.");
  };

  const explicitSave = () => {
    saveDraft(kind, value);
    flash("Draft saved.");
  };

  const downloadScorm = async () => {
    if (!validation.success) {
      flash("Fix the highlighted validation errors first.");
      return;
    }
    try {
      flash("Building SCORM zip…");
      await downloadScormZip(kind, validation.data);
      flash("SCORM zip downloaded.");
    } catch (err) {
      console.error(err);
      flash(err instanceof Error ? `Download failed: ${err.message}` : "Download failed.");
    }
  };

  return (
    <div className="kukui-studio-shell">
      <header className="kukui-studio-header">
        <div>
          <h1 className="kukui-studio-title">Kukui Studio</h1>
          <p className="kukui-studio-subtitle">
            Author interactive activities Lamakū's native quizzing can't do — drag-and-drop,
            slide presentations, 3D, and walkable scenes.
          </p>
        </div>
        <div className="kukui-studio-toolbar">
          <button
            type="button"
            onClick={explicitSave}
            className="kukui-studio-btn kukui-studio-btn--ghost"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={copyJson}
            className="kukui-studio-btn kukui-studio-btn--secondary"
          >
            Copy JSON
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="kukui-studio-btn kukui-studio-btn--secondary"
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={downloadScorm}
            className="kukui-studio-btn kukui-studio-btn--primary"
          >
            Download SCORM zip
          </button>
          <button
            type="button"
            onClick={reset}
            className="kukui-studio-btn kukui-studio-btn--ghost"
          >
            Reset
          </button>
        </div>
      </header>

      <nav className="kukui-studio-sidebar" aria-label="Activity type">
        <h2 className="kukui-studio-sidebar__heading">Activity type</h2>
        <ul className="kukui-studio-sidebar__list">
          {STUDIO_ACTIVITIES.map((k) => (
            <li key={k}>
              <button
                type="button"
                className={[
                  "kukui-studio-sidebar__btn",
                  k === kind ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setKind(k)}
                aria-current={k === kind ? "true" : undefined}
              >
                {ACTIVITY_LABELS[k]}
              </button>
            </li>
          ))}
        </ul>
        <p className="kukui-studio-sidebar__note">
          For multiple-choice / fill-in-the-blank quizzing, use Lamakū's built-in quiz tools —
          Studio focuses on activities the LMS can't do natively. Group + synchronous
          activities are coming in <strong>Kukui Live</strong> (Phase 3).
        </p>
      </nav>

      <main className="kukui-studio-main">
        <section className="kukui-studio-panel">
          <div className="kukui-studio-panel-header">
            <div className="kukui-studio-tab-row">
              <button
                type="button"
                className={[
                  "kukui-studio-subtab",
                  tab === "form" ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setTab("form")}
              >
                Form editor
              </button>
              <button
                type="button"
                className={[
                  "kukui-studio-subtab",
                  tab === "json" ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setTab("json")}
              >
                Raw JSON
              </button>
            </div>
            <ValidationBadge result={validation} />
          </div>
          <div className="kukui-studio-panel-body">
            {tab === "form" ? (
              <EditorForm kind={kind} value={value} onChange={setValue} />
            ) : (
              <JsonEditor value={value} onChange={setValue} />
            )}
          </div>
        </section>

        <section className="kukui-studio-panel">
          <div className="kukui-studio-panel-header">
            <div className="ks-preview-mode" role="tablist" aria-label="Preview mode">
              <button
                type="button"
                role="tab"
                aria-selected={previewMode === "edit"}
                className={[
                  "ks-preview-mode__btn",
                  previewMode === "edit" ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setPreviewMode("edit")}
              >
                ✎ Edit
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={previewMode === "live"}
                className={[
                  "ks-preview-mode__btn",
                  previewMode === "live" ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setPreviewMode("live")}
              >
                ▶ Live
              </button>
            </div>
            <span className="kukui-studio-meta">
              {previewMode === "edit"
                ? "Drag elements directly. Form on the left updates live."
                : "Renders the actual learner-facing component."}
            </span>
          </div>
          <div className="kukui-studio-panel-body kukui-studio-preview">
            <Preview kind={kind} value={value} mode={previewMode} onChange={setValue} />
          </div>
        </section>
      </main>

      {toast ? <div className="kukui-studio-toast">{toast}</div> : null}
    </div>
  );
}

function ValidationBadge({
  result,
}: {
  result: ReturnType<(typeof SchemaRegistry)[SchemaRegistryKey]["safeParse"]>;
}) {
  if (result.success) {
    return (
      <span className="kukui-studio-badge kukui-studio-badge--ok" role="status">
        ✓ Valid
      </span>
    );
  }
  return (
    <span className="kukui-studio-badge kukui-studio-badge--err" role="status">
      {result.error.issues.length} validation issue
      {result.error.issues.length === 1 ? "" : "s"}
    </span>
  );
}
