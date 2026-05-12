import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { type ActivityKind, PLANNED_ACTIVITY_KINDS } from "@kukui/core";
import { SchemaRegistry, type SchemaRegistryKey } from "@kukui/schemas";
import type { ErrorSchema } from "@rjsf/utils";
import type { ZodError } from "zod";
import { EditorForm } from "./EditorForm.js";
import { JsonEditor } from "./JsonEditor.js";
import { Preview, type PreviewMode } from "./Preview.js";
import { hasEditor } from "./EditCanvas/index.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { AISettingsDialog } from "./AISettingsDialog.js";
import { AIEditor } from "./AIEditor.js";
import { Tooltip } from "./Tooltip.js";
import { AsyncStatusStrip, type AsyncStatus } from "./AsyncStatusStrip.js";
import { ValidationBadge } from "./ValidationBadge.js";
import {
  DownloadIcon,
  GearIcon,
  KukuiGlyphIcon,
  PencilIcon,
  PlayIcon,
  SaveIcon,
  SearchIcon,
  UploadIcon,
  XIcon,
} from "./icons.js";
import { ActivityIcon } from "./activityIcons.js";
import { ACTIVITY_LABELS, STARTERS, ensureFreshKeys } from "./starters.js";
import { clearDraft, debouncedSaver, loadDraft, saveDraft } from "./drafts.js";
import { downloadScormZip } from "./scormDownload.js";
import { importFromFile } from "./scormImport.js";
import { slug } from "./util/slug.js";

type Tab = "form" | "json" | "ai";

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
  crossword: "remember",
  // Understand — identify, explain, classify
  "hotspot-2d": "understand",
  "anatomy-labeling": "understand",
  "highlight-text": "understand",
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
  "straw-poll": "evaluate",
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
    // Flashcards is the lowest-friction default: no media to upload, no
    // canvas placements, and a familiar mental model (front/back cards)
    // that lets a first-time author start typing immediately.
    return "flashcards";
  });
  const [value, setValue] = useState<unknown>(() =>
    ensureFreshKeys(kind, loadDraft(kind) ?? STARTERS[kind]),
  );
  // Whether `value` has diverged from STARTERS[kind] for the current
  // activity. Flipped true on any form/json/preview/AI edit, on draft
  // hydration when the draft differs, and on import. Resets to false
  // whenever `kind` changes or the author hits Reset. The AIEditor reads
  // this to decide whether the next request is a from-scratch generate
  // (clean) or an edit (dirty), avoiding a JSON.stringify deep-compare
  // on every render.
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = (next: unknown) => {
    setValue(next);
    setIsDirty(true);
  };
  const [tab, setTab] = useState<Tab>("form");
  const [previewMode, setPreviewMode] = useState<PreviewMode>(() =>
    hasEditor(kind) ? "edit" : "live",
  );
  const [toast, setToast] = useState<string | null>(null);
  /**
   * Sticky status strip in the panel header. Drives long-running async ops
   * (SCORM build, import) that need a visible state until they finish —
   * the transient `toast` auto-dismisses too fast for those. Success
   * states auto-clear after ~3s; error states require explicit dismissal.
   */
  const [asyncStatus, setAsyncStatus] = useState<AsyncStatus | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  // Bumped whenever AI settings are saved/cleared, so AIEditor re-reads
  // them without requiring a page reload (issue #1).
  const [aiSettingsVersion, setAiSettingsVersion] = useState(0);
  // On narrow viewports the editor + preview panels can't both fit, so we
  // hide one or the other. Desktop CSS ignores this — both panels show.
  const [mobilePanel, setMobilePanel] = useState<"edit" | "preview">("edit");
  const [search, setSearch] = useState("");

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

  // Hydrate from draft when kind changes. Dirty-state tracks whether the
  // restored value differs from the starter — a stored draft is by
  // definition dirty (otherwise it wouldn't have been saved).
  useEffect(() => {
    const draft = loadDraft(kind);
    setValue(ensureFreshKeys(kind, draft ?? STARTERS[kind]));
    setIsDirty(draft != null);
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

  // Convert Zod issues into RJSF's ErrorSchema so each issue surfaces on
  // its originating field through the `extraErrors` prop. RJSF's built-in
  // AJV pass still runs (liveValidate=true) to catch things like missing
  // required fields synchronously while the author types; Zod is the
  // canonical source of truth so its issues are the ones the badge counts
  // and the popover lists.
  const extraErrors = useMemo<ErrorSchema | undefined>(
    () => (validation.success ? undefined : zodErrorsToExtraErrors(validation.error)),
    [validation],
  );

  // Sidebar search: case-insensitive substring match against the activity
  // label. We do not change `kind` when the active selection drops out of
  // the filter — that would surprise the user mid-edit.
  const normalizedSearch = search.trim().toLowerCase();
  const matchesSearch = (k: ActivityKind) =>
    normalizedSearch === "" ||
    ACTIVITY_LABELS[k].toLowerCase().includes(normalizedSearch);
  const visibleAvailable = STUDIO_AVAILABLE.filter(matchesSearch);
  const visiblePlanned = STUDIO_PLANNED.filter(matchesSearch);
  const noVisibleActivities = visibleAvailable.length + visiblePlanned.length === 0;

  const handleSearchKeydown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (search) {
        setSearch("");
      } else {
        e.currentTarget.blur();
      }
    } else if (e.key === "Enter") {
      if (visibleAvailable.length + visiblePlanned.length === 1) {
        const only = visibleAvailable[0] ?? visiblePlanned[0];
        if (only && only !== kind) {
          setKind(only);
        }
      }
    }
  };

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  // Auto-clear success-strip after ~3s. Error states are never auto-cleared
  // here (they require explicit user dismissal via AsyncStatusStrip's close
  // button). In-progress states (`building`, `importing`) also stay visible
  // until they transition to success or error. The `kind !== "success"`
  // guard covers all three cases; the dismissable flag is a separate signal
  // for the strip itself (whether to render the × button).
  useEffect(() => {
    if (!asyncStatus || asyncStatus.kind !== "success") return;
    const t = setTimeout(() => setAsyncStatus(null), 3000);
    return () => clearTimeout(t);
  }, [asyncStatus]);

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
    setValue(ensureFreshKeys(kind, STARTERS[kind]));
    setIsDirty(false);
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
  // from Save (in-session) and Download (SCORM zip for the LMS).
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
    const filename = slug((validation.data as { title?: string }).title) || kind;
    a.download = `kukui-${filename}.json`;
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
    setAsyncStatus({
      kind: "importing",
      message: `Importing ${file.name}…`,
      dismissable: false,
    });
    const result = await importFromFile(file);
    if (!result.ok) {
      setAsyncStatus({
        kind: "error",
        message: `Import failed: ${result.error}`,
        dismissable: true,
      });
      return;
    }
    setKind(result.kind);
    setValue(result.config);
    setIsDirty(true);
    setAsyncStatus({
      kind: "success",
      message: `Imported ${ACTIVITY_LABELS[result.kind] ?? result.kind}.`,
      dismissable: true,
    });
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
    setAsyncStatus({
      kind: "building",
      message: "Building SCORM zip…",
      dismissable: false,
    });
    try {
      await downloadScormZip(kind, validation.data);
      setAsyncStatus({
        kind: "success",
        message: "SCORM zip downloaded.",
        dismissable: true,
      });
    } catch (err) {
      console.error(err);
      setAsyncStatus({
        kind: "error",
        message:
          err instanceof Error
            ? `Download failed: ${err.message}`
            : "Download failed.",
        dismissable: true,
      });
    }
  };

  return (
    <div className="kukui-studio-shell">
      <header className="kukui-studio-header">
        <div className="kukui-studio-brand">
          <img
            className="kukui-studio-logo"
            src={`${import.meta.env.BASE_URL}kukui-logo.svg`}
            alt=""
            aria-hidden="true"
          />
          <div className="kukui-studio-brand-text">
            <h1 className="kukui-studio-title">Kukui Studio</h1>
            <p className="kukui-studio-subtitle">
              Interactive learning activities for Lamakū.
            </p>
          </div>
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
            className="kukui-studio-btn kukui-studio-btn--primary kukui-studio-btn--with-subtext kukui-studio-btn--nut-bg"
            title="Download a SCORM 1.2 zip ready to upload into Lamakū or any SCORM 1.2 compatible LMS"
          >
            {/* Decorative candlenut bleeds off the right edge of the
                button — sets the brand without competing with the
                download affordance. aria-hidden so AT skips it. */}
            <KukuiGlyphIcon className="kukui-studio-btn__nut" aria-hidden="true" />
            <DownloadIcon />
            <span className="kukui-studio-btn__stack">
              <span className="kukui-studio-btn__main">Download</span>
              <span className="kukui-studio-btn__sub">SCORM 1.2 zip</span>
            </span>
          </button>
        </div>
      </header>

      {/* Narrow-viewport activity picker — a native <select> avoids the
          stacked-scroller mess of 6 horizontal pill rows on mobile. CSS
          hides this on desktop where the full sidebar renders below. */}
      <div className="kukui-studio-mobile-picker">
        <label className="kukui-studio-mobile-picker__label" htmlFor="kukui-mobile-kind-select">
          Activity type
        </label>
        <select
          id="kukui-mobile-kind-select"
          className="kukui-studio-mobile-picker__select"
          value={kind}
          onChange={(e) => setKind(e.target.value as ActivityKind)}
        >
          {BLOOM_ORDER.map((level) => {
            const kindsAtLevel = STUDIO_AVAILABLE.filter(
              (k) => BLOOM_BY_KIND[k] === level,
            )
              .slice()
              .sort((a, b) => ACTIVITY_LABELS[a].localeCompare(ACTIVITY_LABELS[b]));
            if (kindsAtLevel.length === 0) return null;
            return (
              <optgroup key={level} label={BLOOM_LABELS[level]}>
                {kindsAtLevel.map((k) => (
                  <option key={k} value={k}>
                    {ACTIVITY_LABELS[k]}
                  </option>
                ))}
              </optgroup>
            );
          })}
          {STUDIO_PLANNED.length > 0 ? (
            <optgroup label="In design">
              {STUDIO_PLANNED.map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_LABELS[k]} (in design)
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>

      <nav className="kukui-studio-sidebar" aria-label="Activity type">
        <div className="kukui-studio-sidebar__search">
          <SearchIcon
            className="kukui-studio-sidebar__search-icon"
            aria-hidden="true"
          />
          <input
            type="search"
            className="kukui-studio-sidebar__search-input"
            placeholder="Search activities"
            aria-label="Search activities"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeydown}
          />
          {search ? (
            <button
              type="button"
              className="kukui-studio-sidebar__search-clear"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <XIcon />
            </button>
          ) : null}
        </div>
        {BLOOM_ORDER.map((level) => {
          const kindsAtLevel = visibleAvailable
            .filter((k) => BLOOM_BY_KIND[k] === level)
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
                      <ActivityIcon
                        kind={k}
                        className="kukui-studio-sidebar__btn-icon"
                      />
                      <span className="kukui-studio-sidebar__btn-label">
                        {ACTIVITY_LABELS[k]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {visiblePlanned.length > 0 ? (
          <div className="kukui-studio-sidebar__group">
            <h2 className="kukui-studio-sidebar__heading kukui-studio-sidebar__heading--alt">
              In design
            </h2>
            <ul className="kukui-studio-sidebar__list">
              {visiblePlanned.map((k) => (
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
                    <ActivityIcon
                      kind={k}
                      className="kukui-studio-sidebar__btn-icon"
                    />
                    <span className="kukui-studio-sidebar__btn-label">
                      {ACTIVITY_LABELS[k]}
                    </span>
                    <span className="kukui-studio-sidebar__hint">In design</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {normalizedSearch && noVisibleActivities ? (
          <p className="kukui-studio-sidebar__empty" role="status">
            No activities match "{search.trim()}".
          </p>
        ) : null}
      </nav>

      {/* Narrow-viewport switch between editor and preview panels — on
          desktop CSS hides this and both panels render side-by-side. */}
      <div className="kukui-studio-mobile-switch" role="tablist" aria-label="Show">
        <button
          type="button"
          role="tab"
          aria-selected={mobilePanel === "edit"}
          className={["kukui-studio-mobile-switch__btn", mobilePanel === "edit" ? "is-active" : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setMobilePanel("edit")}
        >
          Editor
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobilePanel === "preview"}
          className={["kukui-studio-mobile-switch__btn", mobilePanel === "preview" ? "is-active" : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setMobilePanel("preview")}
        >
          Preview
        </button>
      </div>

      <main
        className={[
          "kukui-studio-main",
          `kukui-studio-main--show-${mobilePanel}`,
        ].join(" ")}
      >
        <section className="kukui-studio-panel kukui-studio-panel--edit">
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
                Editor
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
              <button
                type="button"
                className={[
                  "kukui-studio-subtab",
                  tab === "ai" ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setTab("ai")}
              >
                AI Assist
              </button>
            </div>
            <div className="kukui-studio-panel-actions">
              <ValidationBadge result={validation} disabled={tab === "json"} />
              <AsyncStatusStrip
                status={asyncStatus}
                onDismiss={() => setAsyncStatus(null)}
              />
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
              <EditorForm
                kind={kind}
                value={value}
                onChange={markDirty}
                extraErrors={extraErrors}
              />
            ) : tab === "json" ? (
              <JsonEditor value={value} onChange={markDirty} />
            ) : (
              <AIEditor
                kind={kind as SchemaRegistryKey}
                value={value}
                onChange={markDirty}
                isDirty={isDirty}
                onOpenSettings={() => setShowAISettings(true)}
                settingsVersion={aiSettingsVersion}
              />
            )}
          </div>
        </section>

        <section className="kukui-studio-panel kukui-studio-panel--preview">
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
            <Tooltip
              label="What does this mode show?"
              text={
                hasEditor(kind) && previewMode === "edit"
                  ? "Drag elements directly on the canvas. The form on the left updates live."
                  : "Renders the actual learner-facing component, exactly as it will appear after the SCORM zip is uploaded."
              }
            />
          </div>
          <div className="kukui-studio-panel-body kukui-studio-preview">
            <Preview kind={kind} value={value} mode={previewMode} onChange={markDirty} />
          </div>
        </section>
      </main>

      <footer className="kukui-studio-footer">
        <p className="kukui-studio-footer__about">
          <strong>Kukui Studio</strong> — open-source interactive learning activities for the
          LMS. Built at{" "}
          <a
            href="https://jabsom.hawaii.edu/"
            target="_blank"
            rel="noopener noreferrer"
            className="kukui-studio-footer__link"
          >
            UH JABSOM
          </a>{" "}
          Office of Medical Education.{" "}
          <span
            className="kukui-studio-footer__pronunciation"
            aria-label="Kukui is pronounced koo-KOO-ee"
          >
            (Kukui · /koo-KOO-ee/)
          </span>
        </p>
        <nav className="kukui-studio-footer__nav" aria-label="Project links">
          <a
            href="https://github.com/UHMed-OME/kukui-studio"
            target="_blank"
            rel="noopener noreferrer"
            className="kukui-studio-footer__link"
          >
            GitHub
          </a>
          <span aria-hidden="true" className="kukui-studio-footer__sep">
            ·
          </span>
          <a
            href="https://github.com/UHMed-OME/kukui-studio/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="kukui-studio-footer__link"
          >
            MIT License
          </a>
          <span aria-hidden="true" className="kukui-studio-footer__sep">
            ·
          </span>
          <button
            type="button"
            className="kukui-studio-footer__btn"
            onClick={() => setShowPrivacy(true)}
          >
            Privacy &amp; data
          </button>
          <span aria-hidden="true" className="kukui-studio-footer__sep">
            ·
          </span>
          <button
            type="button"
            className="kukui-studio-footer__icon-btn"
            onClick={() => setShowAISettings(true)}
            aria-label="AI Assist settings"
            title="AI Assist settings"
          >
            <GearIcon />
          </button>
        </nav>
      </footer>

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

      <ConfirmDialog
        open={showPrivacy}
        title="Privacy & data"
        message="Kukui Studio runs entirely in your browser. Drafts auto-save to your local browser storage (localStorage) and never leave your device. We don't operate any backend, don't set analytics cookies, and don't transmit form data anywhere. When you click Download, the SCORM zip is generated client-side; what happens after upload is between you and your LMS. SCORM activities packaged by Studio post grades only to the LMS that hosts them (D2L Brightspace, Canvas, Moodle, etc.) — same channel any LMS-hosted activity uses. If you enable AI Assist, requests go directly from your browser to whatever LLM endpoint you configured (OpenAI, Groq, your institution's internal proxy, etc.). Kukui Studio never sees or proxies the request. Your API key and base URL are stored in your browser only (localStorage or sessionStorage — your choice in the settings dialog). The activity JSON you're working on, plus your prompt, are sent to the endpoint you picked; the response comes back to your browser only. Your provider's data-handling policies apply to that traffic — pick a provider whose policies match your institution's rules."
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setShowPrivacy(false)}
        onCancel={() => setShowPrivacy(false)}
      />

      <AISettingsDialog
        open={showAISettings}
        onClose={() => setShowAISettings(false)}
        onSaved={() => setAiSettingsVersion((v) => v + 1)}
      />
    </div>
  );
}

/**
 * Walk a `ZodError` and build an RJSF `ErrorSchema` so the per-field
 * inline error renders next to its input. Zod's issue path is
 * (string | number)[]; RJSF nests by key all the way down, with the
 * terminal `__errors` array holding the human-readable messages.
 *
 * Form-wide issues (issue.path is empty) get hoisted onto the root.
 */
function zodErrorsToExtraErrors(err: ZodError): ErrorSchema {
  const root: ErrorSchema = {};
  for (const issue of err.issues) {
    const path = issue.path;
    if (path.length === 0) {
      const list = (root.__errors ??= []);
      list.push(issue.message);
      continue;
    }
    // ErrorSchema is recursive: each path segment becomes a nested key.
    // Use `unknown` to sidestep the recursive index-signature; the
    // runtime shape matches the type exactly.
    let node: Record<string, unknown> = root as Record<string, unknown>;
    for (let i = 0; i < path.length; i++) {
      const seg = String(path[i]);
      const existing = node[seg];
      if (!existing || typeof existing !== "object") {
        node[seg] = {};
      }
      node = node[seg] as Record<string, unknown>;
    }
    const list = (node.__errors as string[] | undefined) ?? [];
    list.push(issue.message);
    node.__errors = list;
  }
  return root;
}

