import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { minNormalized, enforceMinRect } from "./minRect.js";
import { reorder, roundCoord } from "./zorder.js";
import {
  loadSlideAsset,
  newAssetId,
  putSlideAsset,
} from "../slides/slideAssetStore.js";
import {
  importGoogleSlides,
  GoogleSlidesUnavailableError,
} from "../slides/importGoogleSlides.js";

/**
 * Visual editor for the course-presentation activity.
 *
 * The form pane (left) edits chrome (title, author). This canvas owns the deck:
 * importing slides (PDF / PowerPoint-via-PDF / Google Slides), arranging them,
 * and placing positioned interactions on each slide — click-to-reveal info
 * hotspots and embedded multiple-choice / fill-in-the-blanks checkpoints. It's
 * the slide-deck analog of the interactive-video timeline editor.
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

function newId(prefix: string, existing: string[]): string {
  let i = existing.length + 1;
  while (existing.includes(`${prefix}-${i}`)) i += 1;
  return `${prefix}-${i}`;
}

/** A fresh, schema-valid multiple-choice config so a new checkpoint works immediately. */
function seedMcConfig(): McConfig {
  return {
    version: "1.0",
    title: "Checkpoint question",
    question: "<p>New question — edit me.</p>",
    answers: [
      { text: "Correct answer", correct: true },
      { text: "Another option", correct: false },
    ],
  };
}

/** A fresh, schema-valid fill-in-the-blanks config. */
function seedFitbConfig(): Record<string, unknown> {
  return {
    version: "1.0",
    title: "Checkpoint",
    text: "The capital of France is *Paris*.",
  };
}

function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
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

export function CoursePresentationEditor({
  config,
  onChange,
}: {
  config: CPConfig;
  onChange: (next: CPConfig) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
  }, [clampedCurrent]);

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

  /* ---- overlays ----------------------------------------------------------- */

  const addOverlay = (kind: "info" | "checkpoint") => {
    if (!slide || slide.background.kind !== "image") {
      setNotice("Add or import a slide image before placing interactions.");
      return;
    }
    const id = newId(kind === "info" ? "info" : "cp", slide.overlays.map((o) => o.id));
    const overlay: Overlay =
      kind === "info"
        ? { kind: "info", id, rect: { ...DEFAULT_RECT }, label: "Info", html: "<p>Detail to reveal.</p>" }
        : {
            kind: "checkpoint",
            id,
            rect: { ...DEFAULT_RECT },
            required: true,
            activity: { kind: "multipleChoice", config: seedMcConfig() },
          };
    setOverlays([...slide.overlays, overlay]);
    setSelectedOverlayId(id);
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

  /* ---- render ------------------------------------------------------------- */

  return (
    <div className="ks-cp-ed">
      <p className="ks-edit-canvas__hint">
        <strong>Import PDF</strong> to add slides (export PowerPoint / Keynote / Google Slides to
        PDF first). Then <strong>Add hotspot</strong> or <strong>Add checkpoint</strong> drops an
        interaction on the slide — drag it to move, drag its corner to resize, click to edit. Test
        playback on the <strong>Live</strong> tab.
      </p>

      <div className="ks-cp-ed__import">
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--primary"
          onClick={() => fileRef.current?.click()}
          disabled={Boolean(importing)}
        >
          {importing ?? "Import PDF…"}
        </button>
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
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
          onClick={addBlankSlide}
        >
          + Blank slide
        </button>
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
      </div>

      {notice && (
        <p className="ks-cp-ed__notice" role="status">
          {notice}
        </p>
      )}

      {slides.length === 0 ? (
        <div className="ks-cp-ed__empty">
          <p>No slides yet. Import a PDF or add a blank slide to begin.</p>
        </div>
      ) : (
        <>
          {/* Filmstrip */}
          <ol className="ks-cp-ed__strip" aria-label="Slides">
            {slides.map((s, i) => {
              const thumbUrl =
                s.background.kind === "image"
                  ? (s.background.assetId ? urlMap[s.background.assetId] : undefined) ??
                    s.background.src
                  : undefined;
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
                    aria-label={`Slide ${i + 1}${s.title ? `: ${s.title}` : ""}`}
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
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Slide toolbar */}
          <div className="ks-cp-ed__toolbar">
            <span className="ks-cp-ed__count">
              Slide {clampedCurrent + 1} of {slides.length}
            </span>
            <div className="ks-cp-ed__toolbar-actions">
              <button
                type="button"
                className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                onClick={() => moveSlide(clampedCurrent, "backward")}
                disabled={clampedCurrent === 0}
              >
                ← Move
              </button>
              <button
                type="button"
                className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                onClick={() => moveSlide(clampedCurrent, "forward")}
                disabled={clampedCurrent >= slides.length - 1}
              >
                Move →
              </button>
              <button
                type="button"
                className="kukui-studio-btn kukui-studio-btn--primary kukui-studio-btn--sm"
                onClick={() => addOverlay("info")}
              >
                + Hotspot
              </button>
              <button
                type="button"
                className="kukui-studio-btn kukui-studio-btn--primary kukui-studio-btn--sm"
                onClick={() => addOverlay("checkpoint")}
              >
                + Checkpoint
              </button>
              <button
                type="button"
                className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                onClick={() => deleteSlide(clampedCurrent)}
              >
                Delete slide
              </button>
            </div>
          </div>

          {/* Canvas */}
          {slide && (
            <div
              ref={boardRef}
              className="ks-cp-ed__board"
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
                <div className="ks-cp-ed__board-blank">
                  Blank slide — a title / section divider. Interactions need a slide image.
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
                    role="button"
                    tabIndex={0}
                    aria-label={`${o.kind === "info" ? "Info hotspot" : "Checkpoint"}: ${
                      o.kind === "info" ? o.label : o.activity.kind
                    }`}
                  >
                    <span className="ks-cp-ed__overlay-label">
                      {o.kind === "info" ? o.label || "Info" : "Checkpoint"}
                    </span>
                    <span
                      className="ks-cp-ed__overlay-resize"
                      onPointerDown={startResize(o)}
                      aria-hidden="true"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Slide notes */}
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

          {/* Inspector */}
          {selectedOverlay ? (
            <OverlayInspector
              key={selectedOverlay.id}
              overlay={selectedOverlay}
              onPatch={(fields) => patchOverlay(selectedOverlay.id, fields)}
              onRemove={() => removeOverlay(selectedOverlay.id)}
            />
          ) : (
            <p className="ks-cp-ed__noselect">
              Select an interaction on the slide to edit it, or add one above.
            </p>
          )}
        </>
      )}
    </div>
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
        <h3>{overlay.kind === "info" ? "Info hotspot" : "Checkpoint"}</h3>
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
          Cloze text — wrap each blank in asterisks, e.g. <code>*answer*</code>
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
