import { useEffect, useMemo, useState } from "react";
import { ACTIVITY_KINDS, type ActivityKind } from "@kukui/core";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import { EditorForm } from "./EditorForm.js";
import { JsonEditor } from "./JsonEditor.js";
import { Preview } from "./Preview.js";
import { ACTIVITY_LABELS, STARTERS } from "./starters.js";
import { clearDraft, debouncedSaver, loadDraft, saveDraft } from "./drafts.js";

type Tab = "form" | "json";

export function App() {
  const [kind, setKind] = useState<ActivityKind>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("activity");
    if (fromUrl && ACTIVITY_KINDS.includes(fromUrl as ActivityKind)) {
      return fromUrl as ActivityKind;
    }
    return "multiple-choice";
  });
  const [value, setValue] = useState<unknown>(() => loadDraft(kind) ?? STARTERS[kind]);
  const [tab, setTab] = useState<Tab>("form");
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

  return (
    <div className="kukui-studio-shell">
      <header className="kukui-studio-header">
        <div>
          <h1 className="kukui-studio-title">Kukui Studio</h1>
          <p className="kukui-studio-subtitle">
            Pick an activity, edit the form, watch the preview update, download the JSON.
          </p>
        </div>
        <div className="kukui-studio-toolbar">
          <button type="button" onClick={explicitSave} className="kukui-studio-btn kukui-studio-btn--secondary">
            Save draft
          </button>
          <button type="button" onClick={copyJson} className="kukui-studio-btn kukui-studio-btn--secondary">
            Copy JSON
          </button>
          <button type="button" onClick={downloadJson} className="kukui-studio-btn kukui-studio-btn--primary">
            Download JSON
          </button>
          <button type="button" onClick={reset} className="kukui-studio-btn kukui-studio-btn--ghost">
            Reset
          </button>
        </div>
      </header>

      <nav className="kukui-studio-picker" aria-label="Activity type">
        {ACTIVITY_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className={[
              "kukui-studio-tab",
              k === kind ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setKind(k)}
          >
            {ACTIVITY_LABELS[k]}
          </button>
        ))}
      </nav>

      <main className="kukui-studio-grid">
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
            <strong>Live preview</strong>
            <span className="kukui-studio-meta">
              Renders the actual @kukui/core component with your draft as input.
            </span>
          </div>
          <div className="kukui-studio-panel-body kukui-studio-preview">
            <Preview kind={kind} value={value} />
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
