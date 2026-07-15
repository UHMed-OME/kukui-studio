import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { minNormalized, enforceMinRect } from "./minRect.js";
import { seedMcConfig, seedFitbConfig } from "./checkpointSeeds.js";
import { reorder, roundCoord } from "./zorder.js";
import { InlineEdit } from "./InlineEdit.js";
import { loadSlideAsset, newAssetId, putSlideAsset } from "../slides/slideAssetStore.js";
import {
  importGoogleSlides,
  GoogleSlidesUnavailableError,
} from "../slides/importGoogleSlides.js";

/**
 * Visual editor for the course-presentation activity.
 *
 * Two-pane layout (mirrors Hotspot3DEditor): the left column owns the deck —
 * filmstrip, slide toolbar, placement board, notes — and the sticky right rail
 * is contextual: the overlay inspector when an interaction is selected, a
 * slide panel (title, background summary, slide actions) otherwise. A stage
 * header row spans both columns for inline title editing. The activity has a
 * `title` but no `prompt`, so we wire InlineEdit (StageHeader's title
 * primitive) directly rather than rendering StageHeader's mandatory prompt
 * editor for a field the schema doesn't carry.
 *
 * Slide images are large, so they live in IndexedDB (slideAssetStore) keyed by
 * an `assetId`; the saved config holds only the id + alt + dimensions. We
 * resolve ids → object URLs here for the canvas (and Preview does the same for
 * the Live tab).
 */

type Rect = { x: number; y: number; w: number; h: number };

type Answer = { text: string; correct: boolean; feedback?: string };

type McConfig = {
  version: string;
  title: string;
  question: string;
  answers: Answer[];
  [k: string]: unknown;
};

type InfoOverlay = { kind: "info"; id: string; rect: Rect; label: string; html?: string };
type CheckpointOverlay = {
  kind: "checkpoint";
  id: string;
  rect: Rect;
  required?: boolean;
  activity: { kind: "multipleChoice" | "fillInTheBlanks"; config: Record<string, unknown> };
};
type Overlay = InfoOverlay | CheckpointOverlay;
/** A partial update to either overlay variant. */
type OverlayPatch = Partial<InfoOverlay> | Partial<CheckpointOverlay>;

type ImageBg = {
  kind: "image";
  assetId?: string;
  src?: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
};
type Background = ImageBg | { kind: "blank" };

type Slide = {
  id: string;
  title?: string;
  background: Background;
  notes?: string;
  overlays: Overlay[];
};

type CPConfig = { slides?: Slide[]; [k: string]: unknown };

const DEFAULT_RECT: Rect = { x: 0.4, y: 0.42, w: 0.2, h: 0.14 };
/** Keyboard nudge step for move/resize on a focused overlay. */
const NUDGE = 0.01;

function newId(prefix: string, existing: string[]): string {
  let i = existing.length + 1;
  while (existing.includes(`${prefix}-${i}`)) i += 1;
  return `${prefix}-${i}`;
}

function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/** Read an image file's natural pixel dimensions via a transient object URL. */
function readImageDims(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

function hasRequiredCheckpoint(s: Slide): boolean {
  return s.overlays.some((o) => o.kind === "checkpoint" && o.required !== false);
}

/**
 * Resolve slide-image assetIds to object URLs once each, holding them for the
 * editor's lifetime (revoked on unmount). Keyed by assetId so editing the deck
 * doesn't re-mint URLs and flicker the canvas.
 */
function useAssetUrlMap(ids: string[]): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});
  const mapRef = useRef(map);
  mapRef.current = map;

  const key = ids.join(",");
  useEffect(() => {
    let cancelled = false;
    for (const id of ids) {
      if (!id || mapRef.current[id]) continue;
      void loadSlideAsset(id)
        .then((blob) => {
          if (!blob || cancelled) return;
          const url = URL.createObjectURL(blob);
          setMap((m) => (m[id] ? m : { ...m, [id]: url }));
        })
        .catch(() => {
          /* missing asset — canvas shows a placeholder */
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(
    () => () => {
      // jsdom lacks URL.revokeObjectURL; guard so unmount doesn't throw in tests.
      if (typeof URL.revokeObjectURL === "function") {
        Object.values(mapRef.current).forEach((u) => URL.revokeObjectURL(u));
      }
    },
    [],
  );

  return map;
}

type DragState =
  | { mode: "none" }
  | { mode: "move"; id: string; offX: number; offY: number }
  | { mode: "resize"; id: string };

type RailConfirm = "delete" | "convert" | null;

export function CoursePresentationEditor({
  config,
  onChange,
}: {
  config: CPConfig;
  onChange: (next: CPConfig) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const railRef = useRef<HTMLElement>(null);
  /** Rect of the most recently added overlay — new ones cascade from it. */
  const lastAddedRectRef = useRef<Rect | null>(null);

  const slides = useMemo<Slide[]>(
    () => (Array.isArray(config.slides) ? config.slides : []),
    [config.slides],
  );

  const [current, setCurrent] = useState(0);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState>({ mode: "none" });
  const [importing, setImporting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [slidesLink, setSlidesLink] = useState("");
  const [showLinkRow, setShowLinkRow] = useState(false);
  const [addMenuPos, setAddMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [railConfirm, setRailConfirm] = useState<RailConfirm>(null);
  const [railFocusTick, setRailFocusTick] = useState(0);

  const clampedCurrent = Math.min(current, Math.max(0, slides.length - 1));
  const slide = slides[clampedCurrent] ?? null;
  const bg = slide?.background ?? null;

  const assetIds = useMemo(
    () =>
      slides
        .map((s) => (s.background.kind === "image" ? s.background.assetId : undefined))
        .filter((x): x is string => Boolean(x)),
    [slides],
  );
  const urlMap = useAssetUrlMap(assetIds);

  const imageUrl =
    bg && bg.kind === "image" ? (bg.assetId ? urlMap[bg.assetId] : undefined) ?? bg.src : undefined;

  // Reset transient selection when the slide changes underneath us.
  useEffect(() => {
    setSelectedOverlayId(null);
    setDrag({ mode: "none" });
    setRailConfirm(null);
    lastAddedRectRef.current = null;
  }, [clampedCurrent]);

  // Move focus into the rail's first field after an explicit "open" gesture
  // (Enter/Space on an overlay, the Edit action, or adding an overlay). The
  // tick bumps after selection state lands, so the inspector is mounted.
  useEffect(() => {
    if (!railFocusTick) return;
    const el = railRef.current?.querySelector<HTMLElement>("input, textarea, select");
    el?.focus();
  }, [railFocusTick]);
  const focusRail = () => setRailFocusTick((t) => t + 1);

  const commitSlides = (next: Slide[]) => onChange({ ...config, slides: next });

  const patchSlide = (index: number, fields: Partial<Slide>) =>
    commitSlides(slides.map((s, i) => (i === index ? { ...s, ...fields } : s)));

  const setOverlays = (next: Overlay[]) => patchSlide(clampedCurrent, { overlays: next });

  const selectedOverlay =
    slide?.overlays.find((o) => o.id === selectedOverlayId) ?? null;

  /* ---- import ------------------------------------------------------------- */

  const onPickFile = async (file: File) => {
    setNotice(null);
    const name = file.name.toLowerCase();
    if (name.endsWith(".pptx") || name.endsWith(".ppt") || name.endsWith(".key")) {
      setNotice(
        "PowerPoint and Keynote can't be read directly in the browser. In the app, choose File → Export/Save As → PDF, then import that PDF here.",
      );
      return;
    }
    if (!name.endsWith(".pdf")) {
      setNotice("Unsupported file. Import a PDF (export PowerPoint / Keynote / Google Slides to PDF first).");
      return;
    }
    try {
      setImporting("Reading PDF…");
      const { importPdf } = await import("../slides/importPdf.js");
      const imported = await importPdf(file, (done, total) =>
        setImporting(`Rendering slide ${done} of ${total}…`),
      );
      const existingIds = slides.map((s) => s.id);
      // Re-key any id collisions so appended slides stay unique.
      const appended = imported.map((s, i) => {
        let id = s.id;
        while (existingIds.includes(id)) id = `${s.id}-${i}`;
        existingIds.push(id);
        return { ...s, id } as Slide;
      });
      const next = [...slides, ...appended];
      commitSlides(next);
      setCurrent(slides.length); // jump to first imported slide
      setNotice(`Imported ${appended.length} slide${appended.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setNotice(`Couldn't import that PDF: ${(err as Error).message}`);
    } finally {
      setImporting(null);
    }
  };

  const onImportSlidesLink = async () => {
    setNotice(null);
    try {
      await importGoogleSlides(slidesLink);
    } catch (err) {
      if (err instanceof GoogleSlidesUnavailableError) {
        setNotice(err.message);
        return;
      }
      setNotice(`Couldn't import: ${(err as Error).message}`);
    }
  };

  /** Set an image file as the current slide's background (single-image path —
   *  no PDF required). Reads natural dimensions so the board keeps the image's
   *  real aspect, stores the blob in IndexedDB, and points the slide at it. */
  const onPickImage = async (file: File) => {
    setNotice(null);
    if (!file.type.startsWith("image/")) {
      setNotice("That's not an image. Pick a PNG, JPG, or WebP (or use Import PDF for a whole deck).");
      return;
    }
    if (!slide) return;
    try {
      const dims = await readImageDims(file);
      const id = newAssetId();
      await putSlideAsset(id, file);
      const alt = file.name.replace(/\.[^.]+$/, "").trim() || "Slide image";
      patchSlide(clampedCurrent, {
        background: { kind: "image", assetId: id, alt, naturalWidth: dims.w, naturalHeight: dims.h },
      });
    } catch (err) {
      setNotice(`Couldn't add that image: ${(err as Error).message}`);
    }
  };

  /* ---- slide management --------------------------------------------------- */

  const addBlankSlide = () => {
    const id = newId("slide", slides.map((s) => s.id));
    const next: Slide = { id, title: "New slide", background: { kind: "blank" }, overlays: [] };
    commitSlides([...slides, next]);
    setCurrent(slides.length);
  };

  const deleteSlide = (index: number) => {
    const removed = slides[index];
    const next = slides.filter((_, i) => i !== index);
    commitSlides(next);
    setCurrent((c) => Math.max(0, Math.min(c, next.length - 1)));
    setRailConfirm(null);
    // Best-effort asset cleanup is deferred: other slides may share an import
    // run, and undo should still find the blob. The cache-clear control in
    // Connections handles reclaiming space.
    void removed;
  };

  const moveSlide = (index: number, dir: "backward" | "forward") => {
    const next = reorder(slides, index, dir);
    commitSlides(next);
    const delta = dir === "forward" ? 1 : -1;
    setCurrent(Math.max(0, Math.min(slides.length - 1, index + delta)));
  };

  /** Replace an image background with blank. Runtime drops overlays on blank
   *  slides, so callers route through the rail confirm when overlays exist. */
  const convertToBlank = () => {
    patchSlide(clampedCurrent, { background: { kind: "blank" } });
    setRailConfirm(null);
  };

  const requestConvertToBlank = () => {
    if ((slide?.overlays.length ?? 0) > 0) setRailConfirm("convert");
    else convertToBlank();
  };

  /* ---- overlays ----------------------------------------------------------- */

  const addOverlay = (kind: "info" | "checkpoint") => {
    if (!slide || slide.background.kind !== "image") {
      setNotice("Add or import a slide image before placing interactions.");
      return;
    }
    const id = newId(kind === "info" ? "info" : "cp", slide.overlays.map((o) => o.id));
    // Cascade from the previously added overlay so new ones don't stack
    // invisibly; wrap back near center once the offset would leave the slide.
    const prev = lastAddedRectRef.current;
    let rect: Rect = prev
      ? {
          x: roundCoord(prev.x + 0.04),
          y: roundCoord(prev.y + 0.04),
          w: prev.w,
          h: prev.h,
        }
      : { ...DEFAULT_RECT };
    if (rect.x + rect.w > 1 || rect.y + rect.h > 1) rect = { ...DEFAULT_RECT };
    lastAddedRectRef.current = rect;
    const overlay: Overlay =
      kind === "info"
        ? { kind: "info", id, rect, label: "Info", html: "<p>Detail to reveal.</p>" }
        : {
            kind: "checkpoint",
            id,
            rect,
            required: true,
            activity: { kind: "multipleChoice", config: seedMcConfig() },
          };
    setOverlays([...slide.overlays, overlay]);
    setSelectedOverlayId(id);
    focusRail();
  };

  const patchOverlay = (id: string, fields: OverlayPatch) => {
    if (!slide) return;
    setOverlays(
      slide.overlays.map((o) => (o.id === id ? ({ ...o, ...fields } as Overlay) : o)),
    );
  };

  const removeOverlay = (id: string) => {
    if (!slide) return;
    setOverlays(slide.overlays.filter((o) => o.id !== id));
    setSelectedOverlayId(null);
  };

  /* ---- drag / resize ------------------------------------------------------ */

  const toNorm = (clientX: number, clientY: number) => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    const r = board.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  };

  const startMove = (o: Overlay) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    setSelectedOverlayId(o.id);
    const p = toNorm(e.clientX, e.clientY);
    setDrag({ mode: "move", id: o.id, offX: p.x - o.rect.x, offY: p.y - o.rect.y });
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture unavailable — board move handler still tracks */
    }
  };

  const startResize = (o: Overlay) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    setSelectedOverlayId(o.id);
    setDrag({ mode: "resize", id: o.id });
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const onBoardMove = (e: ReactPointerEvent) => {
    if (drag.mode === "none" || !slide) return;
    const p = toNorm(e.clientX, e.clientY);
    const { mw, mh } = minNormalized(boardRef.current);
    setOverlays(
      slide.overlays.map((o) => {
        if (o.id !== drag.id) return o;
        let rect: Rect;
        if (drag.mode === "move") {
          rect = { ...o.rect, x: p.x - drag.offX, y: p.y - drag.offY };
        } else {
          rect = { ...o.rect, w: p.x - o.rect.x, h: p.y - o.rect.y };
        }
        return { ...o, rect: enforceMinRect(rect, mw, mh) } as Overlay;
      }),
    );
  };

  const endDrag = () => {
    if (drag.mode === "none" || !slide) {
      setDrag({ mode: "none" });
      return;
    }
    // Round coordinates once the gesture settles.
    setOverlays(
      slide.overlays.map((o) =>
        o.id === drag.id
          ? {
              ...o,
              rect: {
                x: roundCoord(o.rect.x),
                y: roundCoord(o.rect.y),
                w: roundCoord(o.rect.w),
                h: roundCoord(o.rect.h),
              },
            }
          : o,
      ),
    );
    setDrag({ mode: "none" });
  };

  /* ---- keyboard ------------------------------------------------------------
   * Arrows move the focused overlay by 0.01; Shift+arrows resize; Delete /
   * Backspace removes; Enter / Space selects and moves focus into the rail
   * inspector. Move keeps size and clamps to 0..1; resize clamps then runs
   * through enforceMinRect so the rect never drops below the 44px floor.
   */

  const nudgeOverlay = (id: string, dx: number, dy: number, resize: boolean) => {
    if (!slide) return;
    const { mw, mh } = minNormalized(boardRef.current);
    setOverlays(
      slide.overlays.map((o) => {
        if (o.id !== id) return o;
        let rect: Rect;
        if (resize) {
          rect = enforceMinRect(
            {
              ...o.rect,
              w: Math.min(1 - o.rect.x, o.rect.w + dx),
              h: Math.min(1 - o.rect.y, o.rect.h + dy),
            },
            mw,
            mh,
          );
        } else {
          rect = {
            w: o.rect.w,
            h: o.rect.h,
            x: Math.max(0, Math.min(1 - o.rect.w, o.rect.x + dx)),
            y: Math.max(0, Math.min(1 - o.rect.h, o.rect.y + dy)),
          };
        }
        return {
          ...o,
          rect: {
            x: roundCoord(rect.x),
            y: roundCoord(rect.y),
            w: roundCoord(rect.w),
            h: roundCoord(rect.h),
          },
        } as Overlay;
      }),
    );
  };

  const onOverlayKeyDown = (o: Overlay) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // Only act on keys aimed at the overlay itself — never ones bubbling from
    // an input, textarea, select, contenteditable, or the mini action buttons.
    if (e.target !== e.currentTarget) return;
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, [contenteditable='true']")) return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        nudgeOverlay(o.id, -NUDGE, 0, e.shiftKey);
        break;
      case "ArrowRight":
        e.preventDefault();
        nudgeOverlay(o.id, NUDGE, 0, e.shiftKey);
        break;
      case "ArrowUp":
        e.preventDefault();
        nudgeOverlay(o.id, 0, -NUDGE, e.shiftKey);
        break;
      case "ArrowDown":
        e.preventDefault();
        nudgeOverlay(o.id, 0, NUDGE, e.shiftKey);
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        removeOverlay(o.id);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        setSelectedOverlayId(o.id);
        focusRail();
        break;
      default:
        break;
    }
  };

  /* ---- render ------------------------------------------------------------- */

  const title = typeof config.title === "string" ? config.title : "";
  // Interactions attach to a slide image; on a blank slide the placement
  // buttons are disabled rather than looking active and only erroring.
  const canPlace = bg?.kind === "image";
  const overlayCount = slide?.overlays.length ?? 0;
  const plural = (n: number) => (n === 1 ? "" : "s");

  const slidesLinkRow = (
    <span className="ks-cp-ed__slides-link">
      <input
        type="url"
        placeholder="Paste a Google Slides link…"
        value={slidesLink}
        onChange={(e) => setSlidesLink(e.target.value)}
        aria-label="Google Slides link"
      />
      <button
        type="button"
        className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
        onClick={() => void onImportSlidesLink()}
        disabled={!slidesLink.trim()}
      >
        Import link
      </button>
    </span>
  );

  return (
    <div className="ks-cp-ed">
      <div className="ks-stage-head">
        <InlineEdit
          value={title}
          ariaLabel="Activity title"
          editLabel="Edit activity title"
          placeholder="Untitled activity"
          valueClassName="ks-stage-head__title"
          onCommit={(next) => onChange({ ...config, title: next })}
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf,.pptx,.ppt,.key"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onPickFile(f);
        }}
      />

      <input
        ref={imageFileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onPickImage(f);
        }}
      />

      {notice && (
        <p className="ks-cp-ed__notice" role="status">
          {notice}
        </p>
      )}

      {slides.length === 0 ? (
        /* Staged empty state: three steps, then the import actions. */
        <div className="ks-cp-ed__start">
          <h3 className="ks-cp-ed__start-title">Build a deck learners can interact with</h3>
          <ol className="ks-cp-ed__start-steps">
            <li>Import your slides (PDF)</li>
            <li>Drop hotspots and checkpoints onto them</li>
            <li>Preview as a learner with the Live toggle</li>
          </ol>
          <div className="ks-cp-ed__start-actions">
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--primary"
              onClick={() => fileRef.current?.click()}
              disabled={Boolean(importing)}
            >
              {importing ?? "Import PDF"}
            </button>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--secondary"
              onClick={addBlankSlide}
            >
              Start from a blank slide
            </button>
          </div>
          <details className="ks-cp-ed__start-more">
            <summary>Have a Google Slides link?</summary>
            <div className="ks-cp-ed__start-more-body">{slidesLinkRow}</div>
          </details>
        </div>
      ) : (
        <>
          {/* Left column: filmstrip, toolbar, board, notes */}
          <div className="ks-cp-ed__main">
            <ol className="ks-cp-ed__strip" aria-label="Slides">
              {slides.map((s, i) => {
                const thumbUrl =
                  s.background.kind === "image"
                    ? (s.background.assetId ? urlMap[s.background.assetId] : undefined) ??
                      s.background.src
                    : undefined;
                const required = hasRequiredCheckpoint(s);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={[
                        "ks-cp-ed__thumb",
                        i === clampedCurrent ? "is-current" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setCurrent(i)}
                      aria-current={i === clampedCurrent ? "true" : undefined}
                      aria-label={`Slide ${i + 1}${s.title ? `: ${s.title}` : ""}${
                        required ? ", has required checkpoint" : ""
                      }`}
                    >
                      {thumbUrl ? (
                        <img src={thumbUrl} alt="" />
                      ) : (
                        <span className="ks-cp-ed__thumb-blank">{i + 1}</span>
                      )}
                      {s.overlays.length > 0 && (
                        <span className="ks-cp-ed__thumb-badge" aria-hidden="true">
                          {s.overlays.length}
                        </span>
                      )}
                      {required && (
                        <span
                          className="ks-cp-ed__thumb-req"
                          role="img"
                          aria-label="has required checkpoint"
                          title="Has required checkpoint"
                        >
                          !
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="ks-cp-ed__toolbar">
              <span className="ks-cp-ed__count">
                Slide {clampedCurrent + 1} of {slides.length}
              </span>
              <div className="ks-cp-ed__toolbar-actions">
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--primary kukui-studio-btn--sm"
                  onClick={() => addOverlay("info")}
                  disabled={!canPlace}
                  title={canPlace ? undefined : "Add a slide image before placing interactions"}
                >
                  + Hotspot
                </button>
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--primary kukui-studio-btn--sm"
                  onClick={() => addOverlay("checkpoint")}
                  disabled={!canPlace}
                  title={canPlace ? undefined : "Add a slide image before placing interactions"}
                >
                  + Checkpoint
                </button>
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                  aria-haspopup="menu"
                  aria-expanded={addMenuPos ? "true" : "false"}
                  disabled={Boolean(importing)}
                  onClick={(e) => {
                    if (addMenuPos) {
                      setAddMenuPos(null);
                      return;
                    }
                    const r = e.currentTarget.getBoundingClientRect();
                    setAddMenuPos({ x: r.left, y: r.bottom + 4 });
                  }}
                >
                  {importing ?? "+ Add slides"}
                </button>
              </div>
            </div>

            {addMenuPos && (
              <AddSlidesMenu
                pos={addMenuPos}
                onImportPdf={() => fileRef.current?.click()}
                onBlankSlide={addBlankSlide}
                onSlidesLink={() => setShowLinkRow(true)}
                onClose={() => setAddMenuPos(null)}
              />
            )}

            {showLinkRow && (
              <div className="ks-cp-ed__link-row">
                {slidesLinkRow}
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                  onClick={() => setShowLinkRow(false)}
                >
                  Hide
                </button>
              </div>
            )}

            {slide && (
              <div
                ref={boardRef}
                className={["ks-cp-ed__board", canPlace ? "" : "is-blank"].filter(Boolean).join(" ")}
                style={
                  bg && bg.kind === "image"
                    ? { aspectRatio: `${bg.naturalWidth} / ${bg.naturalHeight}` }
                    : undefined
                }
                onPointerMove={onBoardMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onClick={(e) => {
                  if (e.target === boardRef.current) setSelectedOverlayId(null);
                }}
              >
                {bg && bg.kind === "image" ? (
                  imageUrl ? (
                    <img className="ks-cp-ed__board-img" src={imageUrl} alt={bg.alt} draggable={false} />
                  ) : (
                    <div className="ks-cp-ed__board-missing">Loading slide image…</div>
                  )
                ) : (
                  <div className="ks-cp-ed__board-empty">
                    <p className="ks-cp-ed__board-empty-title">This slide has no image</p>
                    <p className="ks-cp-ed__board-empty-body">
                      Add a slide image to place info hotspots and question checkpoints on it. A
                      blank slide still works on its own as a title or section divider.
                    </p>
                    <div className="ks-cp-ed__board-empty-actions">
                      <button
                        type="button"
                        className="kukui-studio-btn kukui-studio-btn--primary kukui-studio-btn--sm"
                        onClick={() => imageFileRef.current?.click()}
                      >
                        Add slide image
                      </button>
                      <button
                        type="button"
                        className="kukui-studio-btn kukui-studio-btn--secondary kukui-studio-btn--sm"
                        onClick={() => fileRef.current?.click()}
                        disabled={Boolean(importing)}
                      >
                        {importing ?? "Import a deck (PDF)"}
                      </button>
                    </div>
                  </div>
                )}

                {slide.overlays.map((o) => {
                  const isSel = o.id === selectedOverlayId;
                  return (
                    <div
                      key={o.id}
                      className={[
                        "ks-cp-ed__overlay",
                        o.kind === "checkpoint" ? "is-checkpoint" : "is-info",
                        isSel ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        left: `${o.rect.x * 100}%`,
                        top: `${o.rect.y * 100}%`,
                        width: `${o.rect.w * 100}%`,
                        height: `${o.rect.h * 100}%`,
                      }}
                      onPointerDown={startMove(o)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOverlayId(o.id);
                      }}
                      onKeyDown={onOverlayKeyDown(o)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${o.kind === "info" ? "Info hotspot" : "Checkpoint"}: ${
                        o.kind === "info" ? o.label : o.activity.kind
                      }`}
                    >
                      <span className="ks-cp-ed__overlay-label">
                        <span className="ks-cp-ed__overlay-glyph" aria-hidden="true">
                          {o.kind === "info" ? "i" : "?"}
                        </span>
                        {o.kind === "info" ? o.label || "Info" : "Checkpoint"}
                      </span>
                      {isSel && (
                        <span className="ks-cp-ed__overlay-resize" onPointerDown={startResize(o)} aria-hidden="true" />
                      )}
                    </div>
                  );
                })}

                {/* Mini action row for the selected overlay. Rendered as a board
                    sibling (not inside the role=button rect) so buttons aren't
                    interactive descendants of a button. Flips below the rect
                    when the rect hugs the top edge. */}
                {selectedOverlay && (
                  <div
                    className={[
                      "ks-cp-ed__overlay-actions",
                      selectedOverlay.rect.y < 0.12 ? "is-below" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      left: `${selectedOverlay.rect.x * 100}%`,
                      top:
                        selectedOverlay.rect.y < 0.12
                          ? `${(selectedOverlay.rect.y + selectedOverlay.rect.h) * 100}%`
                          : `${selectedOverlay.rect.y * 100}%`,
                    }}
                    role="group"
                    aria-label="Selected interaction actions"
                  >
                    <button type="button" className="ks-cp-ed__overlay-act" onClick={focusRail}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ks-cp-ed__overlay-act ks-cp-ed__overlay-act--danger"
                      onClick={() => removeOverlay(selectedOverlay.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}

            {slide && (
              <label className="ks-cp-ed__notes-field">
                Slide notes (accessible text, shown below the slide)
                <textarea
                  rows={2}
                  value={slide.notes ? htmlToText(slide.notes) : ""}
                  onChange={(e) =>
                    patchSlide(clampedCurrent, {
                      notes: e.target.value ? `<p>${e.target.value}</p>` : undefined,
                    })
                  }
                />
              </label>
            )}
          </div>

          {/* Right rail: overlay inspector when selected, slide panel otherwise. */}
          <aside className="ks-cp-ed__rail" ref={railRef} aria-label="Slide and interaction settings">
            {selectedOverlay ? (
              <OverlayInspector
                key={selectedOverlay.id}
                overlay={selectedOverlay}
                onPatch={(fields) => patchOverlay(selectedOverlay.id, fields)}
                onRemove={() => removeOverlay(selectedOverlay.id)}
              />
            ) : slide ? (
              <div className="ks-cp-ed__panel">
                <h3 className="ks-cp-ed__panel-title">
                  Slide {clampedCurrent + 1} of {slides.length}
                </h3>
                <label className="ks-cp-ed__field">
                  Slide title
                  <input
                    type="text"
                    value={slide.title ?? ""}
                    onChange={(e) =>
                      patchSlide(clampedCurrent, { title: e.target.value || undefined })
                    }
                  />
                </label>
                {bg && bg.kind === "image" ? (
                  <>
                    <label className="ks-cp-ed__field">
                      Image description (alt text)
                      <input
                        type="text"
                        value={bg.alt}
                        placeholder="Describe the slide image"
                        onChange={(e) =>
                          patchSlide(clampedCurrent, { background: { ...bg, alt: e.target.value } })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                      onClick={() => imageFileRef.current?.click()}
                    >
                      Replace image
                    </button>
                  </>
                ) : (
                  <>
                    <p className="ks-cp-ed__bg-summary">Background: blank (title or section divider)</p>
                    <button
                      type="button"
                      className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                      onClick={() => imageFileRef.current?.click()}
                    >
                      Add slide image
                    </button>
                  </>
                )}
                <div className="ks-cp-ed__panel-actions">
                  <button
                    type="button"
                    className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                    onClick={() => moveSlide(clampedCurrent, "backward")}
                    disabled={clampedCurrent === 0}
                  >
                    ← Move back
                  </button>
                  <button
                    type="button"
                    className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                    onClick={() => moveSlide(clampedCurrent, "forward")}
                    disabled={clampedCurrent >= slides.length - 1}
                  >
                    Move forward →
                  </button>
                  {bg && bg.kind === "image" && (
                    <button
                      type="button"
                      className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                      onClick={requestConvertToBlank}
                    >
                      Convert to blank
                    </button>
                  )}
                  <button
                    type="button"
                    className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                    onClick={() => setRailConfirm("delete")}
                  >
                    Delete slide
                  </button>
                </div>
                {railConfirm && (
                  <div className="ks-cp-ed__confirm" role="group" aria-label="Confirm slide change">
                    <p className="ks-cp-ed__confirm-msg">
                      {railConfirm === "convert"
                        ? `This slide has ${overlayCount} interaction${plural(
                            overlayCount,
                          )}; a blank slide hides them. Convert anyway?`
                        : overlayCount > 0
                          ? `Delete slide ${clampedCurrent + 1} and its ${overlayCount} interaction${plural(
                              overlayCount,
                            )}?`
                          : `Delete slide ${clampedCurrent + 1}?`}
                    </p>
                    <div className="ks-cp-ed__confirm-actions">
                      <button
                        type="button"
                        className="kukui-studio-btn kukui-studio-btn--danger kukui-studio-btn--sm"
                        onClick={
                          railConfirm === "convert"
                            ? convertToBlank
                            : () => deleteSlide(clampedCurrent)
                        }
                      >
                        {railConfirm === "convert" ? "Convert" : "Delete"}
                      </button>
                      <button
                        type="button"
                        className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                        onClick={() => setRailConfirm(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <p className="ks-cp-ed__noselect">Select an interaction on the slide to edit it.</p>
              </div>
            ) : null}
          </aside>
        </>
      )}
    </div>
  );
}

/**
 * Compact "+ Add slides" menu. Same look and dismissal contract as the shared
 * ContextMenu (whose API is z-order specific), reusing its .ks-ctx-menu
 * classes: closes on outside pointerdown, Escape, or after any action.
 */
function AddSlidesMenu({
  pos,
  onImportPdf,
  onBlankSlide,
  onSlidesLink,
  onClose,
}: {
  pos: { x: number; y: number };
  onImportPdf: () => void;
  onBlankSlide: () => void;
  onSlidesLink: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const item = (label: string, action: () => void) => (
    <li>
      <button
        type="button"
        role="menuitem"
        className="ks-ctx-menu__btn"
        onClick={() => {
          action();
          onClose();
        }}
      >
        {label}
      </button>
    </li>
  );

  return (
    <ul
      ref={ref}
      className="ks-ctx-menu"
      role="menu"
      aria-label="Add slides"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {item("Import PDF…", onImportPdf)}
      {item("Blank slide", onBlankSlide)}
      {item("Google Slides link…", onSlidesLink)}
    </ul>
  );
}

function OverlayInspector({
  overlay,
  onPatch,
  onRemove,
}: {
  overlay: Overlay;
  onPatch: (fields: OverlayPatch) => void;
  onRemove: () => void;
}) {
  return (
    <div className="ks-cp-ed__inspector">
      <div className="ks-cp-ed__inspector-head">
        <h3>
          <span
            className={[
              "ks-cp-ed__overlay-glyph",
              overlay.kind === "checkpoint" ? "is-checkpoint" : "is-info",
            ].join(" ")}
            aria-hidden="true"
          >
            {overlay.kind === "info" ? "i" : "?"}
          </span>
          {overlay.kind === "info" ? "Info hotspot" : "Checkpoint"}
        </h3>
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
          onClick={onRemove}
        >
          Delete
        </button>
      </div>

      {overlay.kind === "info" ? (
        <>
          <label className="ks-cp-ed__field">
            Hotspot label
            <input
              type="text"
              value={overlay.label}
              onChange={(e) => onPatch({ label: e.target.value })}
            />
          </label>
          <label className="ks-cp-ed__field">
            Revealed content
            <textarea
              rows={3}
              value={overlay.html ? htmlToText(overlay.html) : ""}
              onChange={(e) =>
                onPatch({ html: e.target.value ? `<p>${e.target.value}</p>` : undefined })
              }
            />
          </label>
        </>
      ) : (
        <CheckpointInspector overlay={overlay} onPatch={onPatch} />
      )}
    </div>
  );
}

function CheckpointInspector({
  overlay,
  onPatch,
}: {
  overlay: CheckpointOverlay;
  onPatch: (fields: Partial<CheckpointOverlay>) => void;
}) {
  const isMc = overlay.activity.kind === "multipleChoice";
  const mc = overlay.activity.config as Partial<McConfig>;
  const answers: Answer[] = Array.isArray(mc.answers) ? (mc.answers as Answer[]) : [];

  const setActivityConfig = (cfg: Record<string, unknown>) =>
    onPatch({ activity: { ...overlay.activity, config: cfg } });
  const setAnswers = (next: Answer[]) => setActivityConfig({ ...mc, answers: next });

  const switchKind = (kind: "multipleChoice" | "fillInTheBlanks") => {
    if (kind === overlay.activity.kind) return;
    onPatch({
      activity: {
        kind,
        config: kind === "multipleChoice" ? seedMcConfig() : seedFitbConfig(),
      },
    });
  };

  return (
    <>
      <div className="ks-cp-ed__row">
        <label className="ks-cp-ed__check">
          <input
            type="checkbox"
            checked={overlay.required ?? true}
            onChange={(e) => onPatch({ required: e.target.checked })}
          />
          Required (blocks Next until answered)
        </label>
        <label className="ks-cp-ed__field ks-cp-ed__field--inline">
          Type
          <select
            value={overlay.activity.kind}
            onChange={(e) => switchKind(e.target.value as "multipleChoice" | "fillInTheBlanks")}
          >
            <option value="multipleChoice">Multiple choice</option>
            <option value="fillInTheBlanks">Fill in the blanks</option>
          </select>
        </label>
      </div>

      {isMc ? (
        <>
          <label className="ks-cp-ed__field">
            Question
            <textarea
              rows={2}
              value={htmlToText(typeof mc.question === "string" ? mc.question : "")}
              onChange={(e) => setActivityConfig({ ...mc, question: `<p>${e.target.value}</p>` })}
            />
          </label>
          <div className="ks-cp-ed__answers">
            <span className="ks-cp-ed__answers-label">Answers (pick the correct one)</span>
            {answers.map((a, i) => (
              <div key={i} className="ks-cp-ed__answer">
                <input
                  type="radio"
                  name={`correct-${overlay.id}`}
                  checked={!!a.correct}
                  onChange={() => setAnswers(answers.map((x, j) => ({ ...x, correct: j === i })))}
                  aria-label={`Mark answer ${i + 1} correct`}
                />
                <input
                  type="text"
                  value={a.text}
                  placeholder={`Option ${i + 1}`}
                  onChange={(e) =>
                    setAnswers(answers.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                  }
                />
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--icon kukui-studio-btn--sm"
                  onClick={() => setAnswers(answers.filter((_, j) => j !== i))}
                  disabled={answers.length <= 2}
                  aria-label={`Remove answer ${i + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
              onClick={() => setAnswers([...answers, { text: "", correct: false }])}
            >
              + Add answer
            </button>
          </div>
        </>
      ) : (
        <label className="ks-cp-ed__field">
          Cloze text: wrap each blank in asterisks, e.g. <code>*answer*</code>
          <textarea
            rows={3}
            value={typeof mc.text === "string" ? (mc.text as string) : ""}
            onChange={(e) => setActivityConfig({ ...overlay.activity.config, text: e.target.value })}
          />
        </label>
      )}
    </>
  );
}
