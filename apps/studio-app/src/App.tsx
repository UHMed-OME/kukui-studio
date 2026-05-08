import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { type ActivityKind, PLANNED_ACTIVITY_KINDS } from "@kukui/core";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import { EditorForm } from "./EditorForm.js";
import { JsonEditor } from "./JsonEditor.js";
import { Preview, type PreviewMode } from "./Preview.js";
import { hasEditor } from "./EditCanvas/index.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { DownloadIcon, PencilIcon, PlayIcon, SaveIcon, UploadIcon } from "./icons.js";
import { ACTIVITY_LABELS, STARTERS } from "./starters.js";
import { clearDraft, debouncedSaver, loadDraft, saveDraft } from "./drafts.js";
import { downloadScormZip } from "./scormDownload.js";
import { importFromFile } from "./scormImport.js";

type Tab = "form" | "json";

/**
 * Studio promotes activities the LMS can't do natively. Quiz-style
 * activities (Multiple Choice, Fill in the Blanks, Question Set) live in
 * @kukui/core but aren't surfaced here — use Lamakū's native quiz tools
 * for that.
 *
 * Activities are grouped by Bloom's revised taxonomy level — the highest
 * cognitive level the activity primarily exercises. Sections render in
 * ascending order (Remember → Create) so authors picking by learning
 * objective scan the catalogue from foundational recall up to authoring.
 */
type BloomLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

// Quiz-style kinds (multiple-choice, FIB, question-set) live in @kukui/core
// but aren't surfaced in Studio, so they're omitted from the map.
const BLOOM_BY_KIND: Partial<Record<ActivityKind, BloomLevel>> = {
  // Remember — recall facts, terminology
  flashcards: "remember",
  "matching-pairs": "remember",
  // Understand — identify, explain, classify
  "hotspot-2d": "understand",
  "anatomy-labeling": "understand",
  "highlight-text": "understand",
  // course-presentation deliberately omitted — UH staff already author
  // slides in Google Slides; we're not duplicating that workflow.
  // Apply — use procedures in new contexts
  "drag-and-drop": "apply",
  "sequence-steps": "apply",
  categorization: "apply",
  "hotspot-3d": "apply",
  "virtual-tour": "apply",
  "interactive-video": "apply",
  // Analyze — break apart, compare, infer relationships
  "image-annotation": "analyze",
  "image-comparison-slider": "analyze",
  "concept-map": "analyze",
  "lab-panel": "analyze",
  // Evaluate — judge, critique, decide
  "branching-scenario": "evaluate",
  "ddx-tree": "evaluate",
  "reflection-prompt": "evaluate",
  osce: "evaluate",
  // Create — produce original work
  "audio-recording": "create",
};

const BLOOM_ORDER: readonly BloomLevel[] = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
];

const BLOOM_LABELS: Record<BloomLevel, string> = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyze: "Analyze",
  evaluate: "Evaluate",
  create: "Create",
};

const BLOOM_TAGLINES: Record<BloomLevel, string> = {
  remember: "Recall facts and terminology",
  understand: "Identify, explain, classify",
  apply: "Use knowledge in new situations",
  analyze: "Break apart, compare, infer",
  evaluate: "Judge, critique, decide",
  create: "Produce original work",
};

const STUDIO_AVAILABLE: readonly ActivityKind[] = (
  Object.keys(BLOOM_BY_KIND) as ActivityKind[]
).filter((k) => k in BLOOM_BY_KIND);

const STUDIO_PLANNED: readonly ActivityKind[] = PLANNED_ACTIVITY_KINDS;
const STUDIO_ALL: readonly ActivityKind[] = [...STUDIO_AVAILABLE, ...STUDIO_PLANNED];

export function App() {
  const [kind, setKind] = useState<ActivityKind>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("activity");
    if (fromUrl && STUDIO_ALL.includes(fromUrl as ActivityKind)) {
      return fromUrl as ActivityKind;
    }
    return "drag-and-drop";
  });
  const [value, setValue] = useState<unknown>(() => loadDraft(kind) ?? STARTERS[kind]);
  const [tab, setTab] = useState<Tab>("form");
  const [previewMode, setPreviewMode] = useState<PreviewMode>(() =>
    hasEditor(kind) ? "edit" : "live",
  );
  const [toast, setToast] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Reset preview mode whenever the picked activity changes — kinds with
  // an editor default to "edit", everything else to "live". Keeps the
  // toggle's hidden/shown state in sync with the rendered preview.
  useEffect(() => {
    setPreviewMode(hasEditor(kind) ? "edit" : "live");
  }, [kind]);

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
    setConfirmReset(true);
  };

  const confirmResetNow = () => {
    clearDraft(kind);
    setValue(STARTERS[kind]);
    setConfirmReset(false);
    flash("Reset.");
  };

  // Save = persist the current draft to this browser's storage. Auto-save
  // already does this on every edit, so Save is mostly an explicit
  // confirmation for users who want a beat of certainty.
  const sessionSave = () => {
    saveDraft(kind, value);
    flash("Saved to this browser.");
  };

  // Export = download a portable JSON snapshot of the activity. Distinct
  // from Save (in-session) and Download (SCORM zip for D2L).
  const exportJson = () => {
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
    const slug = filenameSlug((validation.data as { title?: string }).title) || kind;
    a.download = `kukui-${slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash("Exported.");
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerImport = () => fileInputRef.current?.click();

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    flash("Importing…");
    const result = await importFromFile(file);
    if (!result.ok) {
      flash(result.error);
      return;
    }
    setKind(result.kind);
    setValue(result.config);
    flash(`Imported ${ACTIVITY_LABELS[result.kind] ?? result.kind}.`);
  };

  const isPlanned = (STUDIO_PLANNED as readonly string[]).includes(kind);

  const downloadScorm = async () => {
    if (isPlanned) {
      flash("This activity is in design — SCORM download will work once it ships.");
      return;
    }
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
        <div className="kukui-studio-brand">
          <div className="kukui-studio-brand-row">
            <img className="kukui-studio-logo" src="/kukui-logo.svg" alt="" aria-hidden="true" />
            <h1 className="kukui-studio-title">Kukui Studio</h1>
          </div>
          <p className="kukui-studio-subtitle">
            Interactive learning activities for Lamakū.
          </p>
        </div>
        <div className="kukui-studio-toolbar">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json,.zip,application/zip"
            onChange={handleImportFile}
            style={{ display: "none" }}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={sessionSave}
            className="kukui-studio-btn kukui-studio-btn--secondary"
          >
            <SaveIcon />
            <span>Save</span>
          </button>
          <button
            type="button"
            onClick={downloadScorm}
            className="kukui-studio-btn kukui-studio-btn--primary kukui-studio-btn--with-subtext"
            title="Download a SCORM 1.2 zip ready to upload into D2L Brightspace (or any SCORM 1.2 compatible LMS)"
          >
            <DownloadIcon />
            <span className="kukui-studio-btn__stack">
              <span className="kukui-studio-btn__main">Download</span>
              <span className="kukui-studio-btn__sub">SCORM 1.2 zip</span>
            </span>
          </button>
        </div>
      </header>

      <nav className="kukui-studio-sidebar" aria-label="Activity type">
        {BLOOM_ORDER.map((level) => {
          const kindsAtLevel = STUDIO_AVAILABLE.filter((k) => BLOOM_BY_KIND[k] === level)
            .slice()
            .sort((a, b) => ACTIVITY_LABELS[a].localeCompare(ACTIVITY_LABELS[b]));
          if (kindsAtLevel.length === 0) return null;
          return (
            <div key={level} className="kukui-studio-sidebar__group">
              <h2 className="kukui-studio-sidebar__heading">{BLOOM_LABELS[level]}</h2>
              <p className="kukui-studio-sidebar__tagline">{BLOOM_TAGLINES[level]}</p>
              <ul className="kukui-studio-sidebar__list">
                {kindsAtLevel.map((k) => (
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
            </div>
          );
        })}
        {STUDIO_PLANNED.length > 0 ? (
          <div className="kukui-studio-sidebar__group">
            <h2 className="kukui-studio-sidebar__heading kukui-studio-sidebar__heading--alt">
              In design
            </h2>
            <ul className="kukui-studio-sidebar__list">
              {STUDIO_PLANNED.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    className={[
                      "kukui-studio-sidebar__btn kukui-studio-sidebar__btn--planned",
                      k === kind ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setKind(k)}
                    aria-current={k === kind ? "true" : undefined}
                  >
                    {ACTIVITY_LABELS[k]}
                    <span className="kukui-studio-sidebar__hint">In design</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
            <div className="kukui-studio-panel-actions">
              <ValidationBadge result={validation} />
              <button
                type="button"
                onClick={triggerImport}
                className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                title="Import from JSON or SCORM zip"
              >
                <UploadIcon />
                <span>Import</span>
              </button>
              <button
                type="button"
                onClick={exportJson}
                className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                title="Export this activity as a JSON file"
              >
                <DownloadIcon />
                <span>Export</span>
              </button>
              <button
                type="button"
                onClick={reset}
                className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
              >
                Reset
              </button>
            </div>
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
            {hasEditor(kind) ? (
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
                  <PencilIcon />
                  <span>Edit</span>
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
                  <PlayIcon />
                  <span>Live</span>
                </button>
              </div>
            ) : (
              <h2 className="kukui-studio-panel__heading">Live preview</h2>
            )}
            <span className="kukui-studio-meta">
              {hasEditor(kind) && previewMode === "edit"
                ? "Drag elements directly. Form on the left updates live."
                : "Renders the actual learner-facing component."}
            </span>
          </div>
          <div className="kukui-studio-panel-body kukui-studio-preview">
            <Preview kind={kind} value={value} mode={previewMode} onChange={setValue} />
          </div>
        </section>
      </main>

      {/* Persistent live region — announce save/import/error messages to AT.
          Stays in the DOM with empty text when no toast is showing so the
          first message after page load actually fires. */}
      <div
        className={["kukui-studio-toast", toast ? "is-visible" : ""].filter(Boolean).join(" ")}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast ?? ""}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset draft?"
        message="Your draft for this activity will be deleted and the form returns to its starter state. This can't be undone."
        confirmLabel="Reset"
        cancelLabel="Keep editing"
        destructive
        onConfirm={confirmResetNow}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

function filenameSlug(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function ValidationBadge({
  result,
}: {
  result: ReturnType<(typeof SchemaRegistry)[SchemaRegistryKey]["safeParse"]>;
}) {
  if (result.success) {
    return (
      <span className="kukui-studio-badge kukui-studio-badge--ok" role="status">
        Valid
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
