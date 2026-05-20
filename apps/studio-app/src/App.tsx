import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import { type ActivityKind, PLANNED_ACTIVITY_KINDS } from "@kukui/core";
import { ACTIVITY_MANIFESTS } from "@kukui/activities";
import {
  SchemaRegistry,
  type SchemaRegistryKey,
  migrateToScoring,
} from "@kukui/schemas";
import type { ErrorSchema } from "@rjsf/utils";
import type { ZodError } from "zod";
import { EditorForm } from "./EditorForm.js";
import { JsonEditor } from "./JsonEditor.js";
import { ScoringTab, isScoringApplicable } from "./ScoringTab/index.js";
import { Preview, type PreviewMode } from "./Preview.js";
import { hasEditor } from "./EditCanvas/index.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { SettingsDialog, type SettingsPane } from "./settings/SettingsDialog.js";
import { clearAllKukuiStorage } from "./util/resetAll.js";
// AIEditor is lazy-loaded so its ~700 lines + Tiptap dependency tree
// (~120 KB gz) don't sit in the main chunk for the majority of users
// who never open the AI tab.
const AIEditor = lazy(() =>
  import("./AIEditor.js").then((m) => ({ default: m.AIEditor })),
);
import { Tooltip } from "./Tooltip.js";
import { AsyncStatusStrip, type AsyncStatus } from "./AsyncStatusStrip.js";
import { ValidationBadge } from "./ValidationBadge.js";
import {
  DownloadIcon,
  GearIcon,
  KukuiGlyphIcon,
  PencilIcon,
  PlayIcon,
  RedoIcon,
  SearchIcon,
  UndoIcon,
  UploadIcon,
  XIcon,
} from "./icons.js";
import { ActivityIcon } from "./activityIcons.js";
import { ACTIVITY_LABELS, STARTERS, ensureFreshKeys } from "./starters.js";
import { clearDraft, debouncedSaver, loadDraft } from "./drafts.js";
import { downloadScormZip } from "./scormDownload.js";
import { importFromFile } from "./scormImport.js";
import { driveEnabled } from "./drive/config.js";
import { saveJsonToDrive } from "./drive/saveToDrive.js";
import { openJsonFromDrive } from "./drive/openFromDrive.js";
import { MenuButton, type MenuItem } from "./ui/MenuButton.js";
import { slug } from "./util/slug.js";
import { BrandWordmark } from "./pages/shared/BrandWordmark.js";
import { useHistory } from "./hooks/useHistory.js";

type Tab = "form" | "scoring" | "json" | "ai";

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
const LEGACY_BLOOM: Partial<Record<ActivityKind, BloomLevel>> = {
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
  "confidence-meter": "evaluate",
  "qa-board": "evaluate",
  "quick-quiz": "evaluate",
  // "isometric-chatroom": "evaluate", — hidden from the Studio sidebar
  // while the runtime is being reworked. Kind, schema, registry, and
  // existing configs all remain valid; this just hides the picker entry.
  "word-cloud": "remember",
  // Create — produce original work
  "audio-recording": "create",
};

const MANIFEST_BLOOM: Partial<Record<ActivityKind, BloomLevel>> =
  Object.fromEntries(
    Object.values(ACTIVITY_MANIFESTS).map((m) => [m.kind, m.bloom]),
  );

const BLOOM_BY_KIND: Partial<Record<ActivityKind, BloomLevel>> = {
  ...LEGACY_BLOOM,
  ...MANIFEST_BLOOM,
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
  const history = useHistory<unknown>(
    () => ensureFreshKeys(kind, loadDraft(kind) ?? STARTERS[kind]),
  );
  const value = history.value;
  const setValue = history.setValue;
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
  const [settingsPane, setSettingsPane] = useState<SettingsPane | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
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

  // If the author is on the Scoring tab and switches to a Live activity
  // (no scoring tab for those), bounce back to Editor.
  useEffect(() => {
    if (tab === "scoring" && !isScoringApplicable(kind)) {
      setTab("form");
    }
  }, [kind, tab]);

  // Keep ?activity= in sync so refreshes preserve choice.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("activity", kind);
    window.history.replaceState(null, "", url.toString());
  }, [kind]);

  // Hydrate from draft when kind changes. Dirty-state tracks whether the
  // restored value differs from the starter — a stored draft is by
  // definition dirty (otherwise it wouldn't have been saved). Resets the
  // undo history because undoing past a kind switch would produce config
  // shaped for the wrong activity.
  useEffect(() => {
    const draft = loadDraft(kind);
    history.reset(applySchemaDefaults(kind, ensureFreshKeys(kind, draft ?? STARTERS[kind])));
    setIsDirty(draft != null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y) to redo. Skipped
  // when focus is inside a text input or contenteditable so the
  // browser's native text undo still works while typing labels, JSON,
  // prompts, etc. The Studio's "global" undo therefore only fires when
  // the user is interacting with the canvas / form chrome, which is
  // when they actually want config-level undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;
      if (isEditable) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        history.redo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [history]);

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
    history.reset(applySchemaDefaults(kind, ensureFreshKeys(kind, STARTERS[kind])));
    setIsDirty(false);
    setConfirmReset(false);
    flash("Reset.");
  };

  // Export = download a portable JSON snapshot of the activity.
  // Auto-save (debouncedSaver) keeps localStorage in sync on every
  // edit; there's no longer a separate "Save" affordance.
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

  const saveToDrive = async () => {
    if (!validation.success) {
      flash("Fix the highlighted validation errors first.");
      return;
    }
    const filename = `kukui-${slug((validation.data as { title?: string }).title) || kind}.json`;
    setAsyncStatus({
      kind: "building",
      message: "Saving to Google Drive…",
      dismissable: false,
    });
    try {
      const meta = await saveJsonToDrive(
        filename,
        JSON.stringify(validation.data, null, 2),
      );
      setAsyncStatus({
        kind: "success",
        message: `Saved to Drive as ${meta.name}.`,
        dismissable: true,
      });
    } catch (err) {
      setAsyncStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Drive save failed.",
        dismissable: true,
      });
    }
  };

  const openFromDrive = async () => {
    setAsyncStatus({
      kind: "importing",
      message: "Opening Google Drive…",
      dismissable: false,
    });
    try {
      const picked = await openJsonFromDrive();
      if (!picked) {
        setAsyncStatus(null);
        return;
      }
      const file = new File([picked.json], picked.name, {
        type: "application/json",
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
      history.reset(applySchemaDefaults(result.kind, migrateToScoring(result.config, result.kind)));
      setIsDirty(true);
      setAsyncStatus({
        kind: "success",
        message: `Opened ${picked.name} from Drive.`,
        dismissable: true,
      });
    } catch (err) {
      setAsyncStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Drive open failed.",
        dismissable: true,
      });
    }
  };

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
    history.reset(migrateToScoring(result.config, result.kind));
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
        <BrandWordmark />
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
            onClick={history.undo}
            disabled={!history.canUndo}
            className="kukui-studio-btn kukui-studio-btn--icon"
            aria-label="Undo"
            title="Undo (⌘Z)"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={history.redo}
            disabled={!history.canRedo}
            className="kukui-studio-btn kukui-studio-btn--icon"
            aria-label="Redo"
            title="Redo (⇧⌘Z)"
          >
            <RedoIcon />
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
            <div key={level} className="kukui-studio-sidebar__group" data-bloom={level}>
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
              {isScoringApplicable(kind) ? (
                <button
                  type="button"
                  className={[
                    "kukui-studio-subtab",
                    tab === "scoring" ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setTab("scoring")}
                >
                  Scoring
                </button>
              ) : null}
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
              <MenuButton
                label="Import"
                icon={<UploadIcon />}
                title="Import an activity"
                items={[
                  {
                    label: "From local file…",
                    icon: <UploadIcon />,
                    onClick: triggerImport,
                    title: "Open a JSON or SCORM zip from this computer",
                  },
                  ...(driveEnabled()
                    ? ([
                        {
                          label: "From Google Drive…",
                          icon: <UploadIcon />,
                          onClick: openFromDrive,
                          title: "Pick a JSON file from your Google Drive",
                        },
                      ] satisfies MenuItem[])
                    : []),
                ]}
              />
              <MenuButton
                label="Export"
                icon={<DownloadIcon />}
                title="Export this activity"
                items={[
                  {
                    label: "Download as JSON file",
                    icon: <DownloadIcon />,
                    onClick: exportJson,
                    title: "Download a portable JSON snapshot",
                  },
                  ...(driveEnabled()
                    ? ([
                        {
                          label: "Save to Google Drive",
                          icon: <DownloadIcon />,
                          onClick: saveToDrive,
                          title: "Save this activity to your Google Drive",
                        },
                      ] satisfies MenuItem[])
                    : []),
                ]}
              />
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
            ) : tab === "scoring" ? (
              <ScoringTab kind={kind} value={value} onChange={markDirty} />
            ) : tab === "json" ? (
              <JsonEditor value={value} onChange={markDirty} />
            ) : (
              <Suspense
                fallback={
                  <div className="kukui-studio-preview-loading" role="status">
                    Loading AI Assist…
                  </div>
                }
              >
                <AIEditor
                  kind={kind as SchemaRegistryKey}
                  value={value}
                  onChange={markDirty}
                  isDirty={isDirty}
                  onOpenSettings={() => setSettingsPane("connections")}
                  settingsVersion={aiSettingsVersion}
                />
              </Suspense>
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
            <Preview
              kind={kind}
              value={value}
              mode={previewMode}
              onChange={markDirty}
              validation={validation}
            />
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
          Office of Medical Education.
        </p>
        <nav className="kukui-studio-footer__nav" aria-label="Project links">
          <Link to="/docs" className="kukui-studio-footer__link">
            Docs
          </Link>
          <span aria-hidden="true" className="kukui-studio-footer__sep">
            ·
          </span>
          <Link to="/blog" className="kukui-studio-footer__link">
            Blog
          </Link>
          <span aria-hidden="true" className="kukui-studio-footer__sep">
            ·
          </span>
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
          <a
            href="https://give.uhfoundation.org/campaigns/67662/donations/new?utm_medium=redirect&utm_campaign=22MF7"
            target="_blank"
            rel="noopener noreferrer"
            className="kukui-studio-footer__link"
            title="Donate to UH JABSOM's Office of Medical Education via the UH Foundation"
          >
            Donate
          </a>
          <span aria-hidden="true" className="kukui-studio-footer__sep">
            ·
          </span>
          <Link to="/privacy" className="kukui-studio-footer__link">
            Privacy &amp; data
          </Link>
          <span aria-hidden="true" className="kukui-studio-footer__sep">
            ·
          </span>
          <button
            type="button"
            className="kukui-studio-footer__icon-btn"
            onClick={() => setSettingsPane("appearance")}
            aria-label="Settings"
            title="Settings"
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

      <SettingsDialog
        open={settingsPane !== null}
        initialPane={settingsPane ?? "appearance"}
        onClose={() => setSettingsPane(null)}
        onAISaved={() => setAiSettingsVersion((v) => v + 1)}
        onResetAll={() => setConfirmResetAll(true)}
      />

      <ConfirmDialog
        open={confirmResetAll}
        title="Reset everything?"
        message="Clears every saved draft, your AI provider + key, and your appearance preference. Activities reset to their default starter. This can't be undone — make sure you've exported anything you want to keep first."
        confirmLabel="Reset everything"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          clearAllKukuiStorage();
          // Full reload to "/" so every in-memory consumer (drafts, AI
          // version, color-scheme listener) re-reads from a clean slate.
          window.location.assign("/");
        }}
        onCancel={() => setConfirmResetAll(false)}
      />
    </div>
  );
}

/**
 * Bake Zod's schema defaults into a config value before it becomes
 * form state. Zod's `safeParse` returns the defaults in `data` (e.g.
 * `appearance: { theme: "auto" }`), but the form holds the unmodified
 * input — without this normalisation step, RJSF's AJV liveValidate
 * sees missing-but-defaulted fields as "required field missing" and
 * flips the ValidationBadge to errors, even though Zod itself is
 * happy. Applied at every entry point that seeds a fresh value:
 * kind-switch mount, Reset, and import paths.
 *
 * On parse failure (real user-authored issue) we return the value
 * unchanged so the editor surfaces the actual schema errors instead
 * of swallowing them under a generic fallback.
 */
function applySchemaDefaults(kind: ActivityKind, value: unknown): unknown {
  const schema = SchemaRegistry[kind as SchemaRegistryKey];
  if (!schema) return value;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : value;
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

