import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ImageAnnotationConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { ActivityHeader, SafeHtml } from "@kukui/core";
import { bandMessage, percentage, resolveScoring } from "@kukui/core/scoring";
import "./Component.css";

type ToolKind = "rectangle" | "circle" | "arrow" | "freehand" | "eraser";

type Point = { x: number; y: number };

export type AnnotationShape = {
  id: string;
  kind: "rectangle" | "circle" | "arrow" | "freehand";
  /**
   * Normalized 0..1 coordinates over the image.
   * - rectangle / circle: 2 points (start + end corners; circle uses bounding box)
   * - arrow: 2 points (tail + head)
   * - freehand: N points polyline
   *
   * Stroke color is a fixed design token applied in CSS, so no per-shape
   * color is stored here.
   */
  points: Point[];
  label?: string;
};

type State = {
  shapes: AnnotationShape[];
  tool: ToolKind;
  submitted: boolean;
  attempts: number;
};

type Drag = {
  shapeId: string;
  kind: "rectangle" | "circle" | "arrow" | "freehand";
  start: Point;
};

const SHAPE_KINDS = new Set<AnnotationShape["kind"]>([
  "rectangle",
  "circle",
  "arrow",
  "freehand",
]);

/** Normalized keyboard nudge / resize step per arrow-key press. */
const NUDGE = 0.02;

const TOOL_META: Record<
  ToolKind,
  { label: string; icon: string; shapeKind: AnnotationShape["kind"] | null }
> = {
  rectangle: { label: "Rectangle", icon: "▭", shapeKind: "rectangle" },
  circle: { label: "Circle", icon: "○", shapeKind: "circle" },
  arrow: { label: "Arrow", icon: "→", shapeKind: "arrow" },
  freehand: { label: "Freehand", icon: "✎", shapeKind: "freehand" },
  eraser: { label: "Eraser", icon: "⌫", shapeKind: null },
};

/**
 * Image Annotation / Draw on Image, learner draws shapes on an image.
 *
 * Toolbar above the image provides tool buttons (rectangle, circle, arrow,
 * freehand, eraser, clear), an "Add rectangle" button that places a shape
 * without a pointer, and a Submit. Drawing happens via pointer events on an
 * SVG overlay sized to match the image, and every placed shape is also
 * keyboard-operable from the shape list below. Coordinates are normalized
 * 0..1 over the image so shapes survive responsive layout.
 *
 * Scoring: completion-only by default (raw=1, max=1, success=true). When
 * `expectedAnnotations` is set, score by whether each expected region is
 * covered: rectangle / circle / freehand match by bounding-box IoU (>= 0.5),
 * an arrow matches when its tip falls inside the region. `singlePoint`
 * collapses to all-or-nothing.
 */
export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<ImageAnnotationConfig>) {
  const headingId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const idCounterRef = useRef(0);

  const scoring = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);

  const enabledTools = useMemo<ToolKind[]>(() => {
    const t = config.tools;
    const list: ToolKind[] = [];
    if (t?.rectangle ?? true) list.push("rectangle");
    if (t?.circle ?? true) list.push("circle");
    if (t?.arrow ?? true) list.push("arrow");
    if (t?.freehand ?? true) list.push("freehand");
    list.push("eraser");
    return list;
  }, [config.tools]);

  const initialTool: ToolKind = enabledTools[0] ?? "rectangle";

  // First enabled tool that actually draws a shape (skips eraser). Used by
  // the non-pointer "Add" button so the keyboard path honors config.tools.
  const addKind: AnnotationShape["kind"] = useMemo(() => {
    const drawable = enabledTools.find((t) => TOOL_META[t].shapeKind);
    return (drawable && TOOL_META[drawable].shapeKind) || "rectangle";
  }, [enabledTools]);

  const [state, setState] = useState<State>(
    () =>
      parseSuspend(suspendData, initialTool) ?? {
        shapes: [],
        tool: initialTool,
        submitted: false,
        attempts: 0,
      },
  );
  const [solutionsRevealed, setSolutionsRevealed] = useState(false);

  // Sync the id counter past anything restored from suspend so new shape
  // ids never collide with persisted ones.
  useEffect(() => {
    idCounterRef.current = Math.max(
      idCounterRef.current,
      ...state.shapes.map((s) => parseInt(s.id.replace(/\D/g, ""), 10) || 0),
    );
    // run once on mount only (persisted ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop:
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(
      parseSuspend(suspendData, initialTool) ?? {
        shapes: [],
        tool: initialTool,
        submitted: false,
        attempts: 0,
      },
    );
    setSolutionsRevealed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (!onPersist) return;
    // Skip persisting while a pointer drag is live. A freehand stroke pushes
    // a new vertex on every pointermove; persisting each one would hammer the
    // SCORM commit path. dragRef is cleared on pointerup, and that same
    // pointerup runs a setState (dropping zero-area shapes), so this effect
    // re-runs once at drag end and persists the finished shape.
    if (dragRef.current) return;
    // Persist `submitted` + `attempts` too. Without these, a learner who
    // submits and then resumes from SCORM lands back in the unsubmitted
    // state with their shapes restored, they can keep drawing and
    // re-submit, which silently corrupts the grade.
    onPersist(
      JSON.stringify({
        shapes: state.shapes,
        submitted: state.submitted,
        attempts: state.attempts,
      }),
    );
  }, [state.shapes, state.submitted, state.attempts, onPersist]);

  const nextId = () => `s${++idCounterRef.current}`;

  const toClientPoint = (e: { clientX: number; clientY: number }): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    const x = clamp01((e.clientX - rect.left) / w);
    const y = clamp01((e.clientY - rect.top) / h);
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (state.submitted) return;
    if (state.tool === "eraser") return;
    // Ignore a second concurrent pointerdown (e.g. a multi-touch second
    // finger) while a drag is already in progress.
    if (dragRef.current) return;
    const meta = TOOL_META[state.tool];
    if (!meta.shapeKind) return;

    // Only respond to primary button.
    if (e.button !== undefined && e.button !== 0) return;

    const p = toClientPoint(e);
    const id = nextId();
    const shapeKind = meta.shapeKind;
    const newShape: AnnotationShape = {
      id,
      kind: shapeKind,
      points: shapeKind === "freehand" ? [p] : [p, p],
    };

    dragRef.current = { shapeId: id, kind: shapeKind, start: p };
    setState((s) => ({ ...s, shapes: [...s.shapes, newShape] }));

    // Pointer capture so we keep getting move events even if the cursor
    // leaves the SVG bounds mid-drag.
    try {
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    } catch {
      /* JSDOM stub may not implement setPointerCapture */
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toClientPoint(e);
    setState((s) => {
      const shapes = s.shapes.map((shape) => {
        if (shape.id !== drag.shapeId) return shape;
        if (shape.kind === "freehand") {
          return { ...shape, points: [...shape.points, p] };
        }
        return { ...shape, points: [drag.start, p] };
      });
      return { ...s, shapes };
    });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    try {
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    } catch {
      /* JSDOM stub may not implement releasePointerCapture */
    }
    // Drop zero-area shapes so an accidental click doesn't litter the canvas.
    setState((s) => ({
      ...s,
      shapes: s.shapes.filter((shape) => {
        if (shape.kind === "freehand") return shape.points.length > 1;
        const [a, b] = shape.points;
        if (!a || !b) return false;
        return Math.abs(a.x - b.x) > 0.005 || Math.abs(a.y - b.y) > 0.005;
      }),
    }));
  };

  const removeShape = (id: string) => {
    if (state.submitted) return;
    setState((s) => ({ ...s, shapes: s.shapes.filter((sh) => sh.id !== id) }));
  };

  const selectTool = (t: ToolKind) => {
    if (state.submitted) return;
    setState((s) => ({ ...s, tool: t }));
  };

  const clearAll = () => {
    if (state.submitted) return;
    setState((s) => ({ ...s, shapes: [] }));
  };

  // Non-pointer path to create an annotation (WCAG 2.1.1). Places a
  // default-size shape in the center of the canvas; the learner then refines
  // it with the keyboard controls on the shape list below.
  const addDefaultShape = () => {
    if (state.submitted) return;
    const id = nextId();
    let points: Point[];
    if (addKind === "freehand") {
      points = [
        { x: 0.4, y: 0.45 },
        { x: 0.5, y: 0.55 },
        { x: 0.6, y: 0.45 },
      ];
    } else if (addKind === "arrow") {
      points = [
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.5 },
      ];
    } else {
      points = [
        { x: 0.4, y: 0.4 },
        { x: 0.6, y: 0.6 },
      ];
    }
    setState((s) => ({ ...s, shapes: [...s.shapes, { id, kind: addKind, points }] }));
  };

  const moveShape = (id: string, dx: number, dy: number) => {
    if (state.submitted) return;
    setState((s) => ({
      ...s,
      shapes: s.shapes.map((sh) =>
        sh.id !== id
          ? sh
          : {
              ...sh,
              points: sh.points.map((p) => ({
                x: clamp01(p.x + dx),
                y: clamp01(p.y + dy),
              })),
            },
      ),
    }));
  };

  // Resize by moving the shape's final point (rectangle / circle end corner,
  // arrow head, or last freehand vertex).
  const resizeShape = (id: string, dx: number, dy: number) => {
    if (state.submitted) return;
    setState((s) => ({
      ...s,
      shapes: s.shapes.map((sh) => {
        if (sh.id !== id || sh.points.length === 0) return sh;
        const points = sh.points.slice();
        const last = points.length - 1;
        points[last] = {
          x: clamp01(points[last]!.x + dx),
          y: clamp01(points[last]!.y + dy),
        };
        return { ...sh, points };
      }),
    }));
  };

  const onShapeKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (state.submitted) return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        e.shiftKey ? resizeShape(id, -NUDGE, 0) : moveShape(id, -NUDGE, 0);
        break;
      case "ArrowRight":
        e.preventDefault();
        e.shiftKey ? resizeShape(id, NUDGE, 0) : moveShape(id, NUDGE, 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        e.shiftKey ? resizeShape(id, 0, -NUDGE) : moveShape(id, 0, -NUDGE);
        break;
      case "ArrowDown":
        e.preventDefault();
        e.shiftKey ? resizeShape(id, 0, NUDGE) : moveShape(id, 0, NUDGE);
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        removeShape(id);
        break;
      default:
        break;
    }
  };

  const submit = () => {
    if (state.submitted) return;
    const score = computeScore(state.shapes, config, scoring.mode === "all-or-nothing");
    const next: State = { ...state, submitted: true, attempts: state.attempts + 1 };
    setState(next);
    onSubmit({
      ...score,
      // Serialize the full resume state (not just shapes) so a mid-graded
      // resume restores `submitted` + `attempts`, matching the onPersist
      // contract above.
      suspendData: JSON.stringify({
        shapes: next.shapes,
        submitted: next.submitted,
        attempts: next.attempts,
      }),
    });
  };

  const tryAgain = () => {
    setSolutionsRevealed(false);
    setState((s) => ({ ...s, submitted: false, shapes: [] }));
  };

  const submitLabel = config.ui?.submitButtonLabel ?? "Submit";
  const clearLabel = config.ui?.clearButton ?? "Clear all";
  const addLabel = `Add ${addKind}`;

  const expected = config.expectedAnnotations;
  const isScored = !!(expected && expected.length > 0);
  const result = state.submitted
    ? computeScore(state.shapes, config, scoring.mode === "all-or-nothing")
    : null;
  const pct = result ? percentage(result) : 0;
  const banner = result ? bandMessage(scoring.bands, pct) : null;

  return (
    <div className="kukui-ia">
      <article className="kukui-ia__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          prompt={config.prompt ? <SafeHtml html={config.prompt} /> : undefined}
        />

        <div
          className="kukui-ia__toolbar"
          role="toolbar"
          aria-label="Annotation tools"
        >
          {enabledTools.map((t) => {
            const isSelected = state.tool === t;
            return (
              <button
                key={t}
                type="button"
                className={[
                  "kukui-ia__tool",
                  isSelected ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={isSelected}
                aria-label={TOOL_META[t].label}
                disabled={state.submitted}
                onClick={() => selectTool(t)}
              >
                <span aria-hidden="true" className="kukui-ia__tool-icon">
                  {TOOL_META[t].icon}
                </span>
                <span className="kukui-ia__tool-text">{TOOL_META[t].label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="kukui-ia__tool kukui-ia__tool--add"
            disabled={state.submitted}
            onClick={addDefaultShape}
          >
            <span aria-hidden="true" className="kukui-ia__tool-icon">
              ＋
            </span>
            <span className="kukui-ia__tool-text">{addLabel}</span>
          </button>
          <button
            type="button"
            className="kukui-ia__tool kukui-ia__tool--clear"
            disabled={state.submitted || state.shapes.length === 0}
            onClick={clearAll}
          >
            <span aria-hidden="true" className="kukui-ia__tool-icon">
              ⨯
            </span>
            <span className="kukui-ia__tool-text">{clearLabel}</span>
          </button>
        </div>

        <div className="kukui-ia__canvas">
          {config.image ? (
            <img
              src={config.image.src}
              alt={config.image.alt ?? ""}
              className="kukui-ia__image"
              draggable={false}
            />
          ) : (
            <div className="kukui-ia__no-image" role="status">
              <strong>Add an image to annotate.</strong>
              <span>Open the Editor tab and pick an image. Until then, the annotation tools are inert.</span>
            </div>
          )}
          <svg
            ref={svgRef}
            className={[
              "kukui-ia__svg",
              `kukui-ia__svg--tool-${state.tool}`,
              state.submitted ? "is-submitted" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            data-testid="kukui-ia-svg"
            role="application"
            aria-label="Drawing canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <defs>
              {/*
                Arrowhead. The shape strokes use vector-effect:non-scaling-stroke,
                so a `stroke-width: 2` (CSS) renders as ~2 device px regardless of
                the 0..1 viewBox. markerUnits="strokeWidth" scales the marker by
                that rendered stroke width, so markerWidth/Height of 5 yields a
                ~10px arrowhead (5 x 2px). Using the old "userSpaceOnUse" units
                sized the marker in user space, where 6 units is 6x the whole
                canvas. The 0..10 marker viewBox with refX=8 anchors the tip just
                past the line end.
              */}
              <marker
                id={`${headingId}-arrow`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {isScored && solutionsRevealed
              ? expected!.map((ex) => (
                  <rect
                    key={`expected-${ex.id}`}
                    className="kukui-ia__expected"
                    data-testid={`expected-${ex.id}`}
                    x={ex.rect.x}
                    y={ex.rect.y}
                    width={ex.rect.w}
                    height={ex.rect.h}
                  />
                ))
              : null}
            {state.shapes.map((shape) => (
              <ShapeNode
                key={shape.id}
                shape={shape}
                arrowMarkerId={`${headingId}-arrow`}
                erase={
                  state.tool === "eraser" && !state.submitted
                    ? () => removeShape(shape.id)
                    : null
                }
              />
            ))}
          </svg>
        </div>

        <div className="kukui-ia__shape-list" aria-live="polite">
          {state.shapes.length === 0 ? (
            <p className="kukui-ia__empty">No annotations yet.</p>
          ) : (
            <ul>
              {state.shapes.map((s, i) => (
                <li key={s.id} className="kukui-ia__shape-row">
                  <button
                    type="button"
                    className="kukui-ia__shape-handle"
                    aria-label={`${s.kind} ${i + 1}. Use the arrow keys to move, hold Shift and arrow keys to resize, Delete to remove.`}
                    disabled={state.submitted}
                    onKeyDown={(e) => onShapeKeyDown(e, s.id)}
                  >
                    <span className="kukui-ia__shape-num">{i + 1}.</span>
                    <span className="kukui-ia__shape-kind">{s.kind}</span>
                  </button>
                  {!state.submitted ? (
                    <button
                      type="button"
                      className="kukui-ia__shape-remove"
                      aria-label={`Remove ${s.kind} ${i + 1}`}
                      onClick={() => removeShape(s.id)}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="kukui-ia__actions">
          {!state.submitted ? (
            <button
              type="button"
              className="kukui-ia__primary"
              disabled={state.shapes.length === 0}
              onClick={submit}
            >
              {submitLabel}
            </button>
          ) : (
            <>
              <output className="kukui-ia__status">
                {isScored && result ? (
                  <>
                    Score: {result.raw} / {result.max}
                    {banner ? (
                      <span className="kukui-ia__band"> ({banner})</span>
                    ) : null}
                  </>
                ) : (
                  <>
                    Submitted: {state.shapes.length} annotation
                    {state.shapes.length === 1 ? "" : "s"} recorded.
                  </>
                )}
              </output>
              {scoring.enableRetry ? (
                <button
                  type="button"
                  className="kukui-ia__secondary"
                  onClick={tryAgain}
                >
                  Try again
                </button>
              ) : null}
              {isScored && scoring.enableSolutionsButton && !solutionsRevealed ? (
                <button
                  type="button"
                  className="kukui-ia__secondary"
                  onClick={() => setSolutionsRevealed(true)}
                >
                  Show expected regions
                </button>
              ) : null}
            </>
          )}
        </div>
      </article>
    </div>
  );
}

function ShapeNode({
  shape,
  arrowMarkerId,
  erase,
}: {
  shape: AnnotationShape;
  arrowMarkerId: string;
  erase: (() => void) | null;
}) {
  const onClick = useCallback(
    (e: React.MouseEvent<SVGElement>) => {
      if (!erase) return;
      e.stopPropagation();
      erase();
    },
    [erase],
  );
  const cursor = erase ? "pointer" : "default";

  if (shape.kind === "rectangle") {
    const [a, b] = shape.points;
    if (!a || !b) return null;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x);
    const h = Math.abs(a.y - b.y);
    return (
      <rect
        className="kukui-ia__shape kukui-ia__shape--rect"
        data-testid={`shape-${shape.id}`}
        data-kind="rectangle"
        x={x}
        y={y}
        width={w}
        height={h}
        onClick={onClick}
        style={{ cursor }}
      />
    );
  }
  if (shape.kind === "circle") {
    const [a, b] = shape.points;
    if (!a || !b) return null;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(a.x - b.x) / 2;
    const ry = Math.abs(a.y - b.y) / 2;
    return (
      <ellipse
        className="kukui-ia__shape kukui-ia__shape--circle"
        data-testid={`shape-${shape.id}`}
        data-kind="circle"
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        onClick={onClick}
        style={{ cursor }}
      />
    );
  }
  if (shape.kind === "arrow") {
    const [a, b] = shape.points;
    if (!a || !b) return null;
    return (
      <line
        className="kukui-ia__shape kukui-ia__shape--arrow"
        data-testid={`shape-${shape.id}`}
        data-kind="arrow"
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        markerEnd={`url(#${arrowMarkerId})`}
        onClick={onClick}
        style={{ cursor }}
      />
    );
  }
  // freehand
  const d = shape.points.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <polyline
      className="kukui-ia__shape kukui-ia__shape--freehand"
      data-testid={`shape-${shape.id}`}
      data-kind="freehand"
      points={d}
      onClick={onClick}
      style={{ cursor }}
    />
  );
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

type Rect = { x: number; y: number; w: number; h: number };
type ScoreOut = { raw: number; max: number; success: boolean };

function boundingBox(points: Point[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function computeScore(
  shapes: AnnotationShape[],
  config: ImageAnnotationConfig,
  singlePoint: boolean,
): ScoreOut {
  const expected = config.expectedAnnotations;
  if (!expected || expected.length === 0) {
    // Completion-only: any annotation = success.
    return { raw: 1, max: 1, success: shapes.length > 0 };
  }
  // Score each expected region against every learner shape. Area shapes
  // (rectangle / circle / freehand) match by bounding-box IoU >= 0.5; an
  // arrow matches when its tip lands inside the region. This covers the
  // freehand + arrow tools the sample prompt asks learners to use, which
  // previously always scored zero.
  let hits = 0;
  for (const ex of expected) {
    const exRect = ex.rect;
    let matched = false;
    for (const sh of shapes) {
      if (sh.points.length < 2) continue;
      if (sh.kind === "arrow") {
        const tip = sh.points[sh.points.length - 1];
        if (tip && pointInRect(tip, exRect)) {
          matched = true;
          break;
        }
        continue;
      }
      const bb = boundingBox(sh.points);
      if (computeIoU(bb, exRect) >= 0.5) {
        matched = true;
        break;
      }
    }
    if (matched) hits += 1;
  }
  const max = expected.length;
  if (singlePoint) {
    const all = hits === max;
    return { raw: all ? 1 : 0, max: 1, success: all };
  }
  return { raw: hits, max, success: hits === max };
}

function computeIoU(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  const inter = (x2 - x1) * (y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  if (union <= 0) return 0;
  return inter / union;
}

function isPoint(p: unknown): p is Point {
  return (
    !!p &&
    typeof p === "object" &&
    typeof (p as Point).x === "number" &&
    typeof (p as Point).y === "number" &&
    Number.isFinite((p as Point).x) &&
    Number.isFinite((p as Point).y)
  );
}

function parseSuspend(s: string | undefined, fallbackTool: ToolKind): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as {
      shapes?: unknown;
      submitted?: unknown;
      attempts?: unknown;
    };
    if (!parsed || !Array.isArray(parsed.shapes)) return null;
    const shapes: AnnotationShape[] = [];
    for (const raw of parsed.shapes) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      // Validate restored data rather than trusting it: bad ids / unknown
      // kinds / non-point vertices are dropped, and coordinates are clamped
      // back into 0..1. (Legacy payloads may carry a `color` field; it is no
      // longer used and simply ignored.)
      if (typeof r.id !== "string") continue;
      if (typeof r.kind !== "string" || !SHAPE_KINDS.has(r.kind as AnnotationShape["kind"])) {
        continue;
      }
      if (!Array.isArray(r.points)) continue;
      const points: Point[] = r.points
        .filter(isPoint)
        .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }));
      if (points.length < 2) continue;
      shapes.push({ id: r.id, kind: r.kind as AnnotationShape["kind"], points });
    }
    return {
      shapes,
      // Reset to the first enabled tool, not a hard-coded "rectangle" that
      // may be disabled in config.tools.
      tool: fallbackTool,
      submitted: parsed.submitted === true,
      attempts:
        typeof parsed.attempts === "number" && Number.isFinite(parsed.attempts)
          ? parsed.attempts
          : 0,
    };
  } catch {
    return null;
  }
}
