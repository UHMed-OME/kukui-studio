import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ImageAnnotationConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { SafeHtml } from "@kukui/core";
import { resolveScoring } from "@kukui/core/scoring";
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
   */
  points: Point[];
  color: string;
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

const ALL_TOOLS: ToolKind[] = ["rectangle", "circle", "arrow", "freehand", "eraser"];

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
 * Image Annotation / Draw on Image — learner draws shapes on an image.
 *
 * Toolbar above the image provides tool buttons (rectangle, circle, arrow,
 * freehand, eraser, clear) plus a Submit. Drawing happens via pointer events
 * on an SVG overlay sized to match the image. Coordinates are normalized
 * 0..1 over the image so shapes survive responsive layout.
 *
 * Scoring: completion-only by default (raw=1, max=1, success=true). When
 * `expectedAnnotations` is set, score by IoU between learner rectangles /
 * circles and the expected regions (>=50% overlap = correct). `singlePoint`
 * collapses to all-or-nothing.
 */
export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<ImageAnnotationConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
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

  const [state, setState] = useState<State>(
    () =>
      parseSuspend(suspendData) ?? {
        shapes: [],
        tool: initialTool,
        submitted: false,
        attempts: 0,
      },
  );

  // Sync the id counter past anything restored from suspend so new shape
  // ids never collide with persisted ones.
  useEffect(() => {
    idCounterRef.current = Math.max(
      idCounterRef.current,
      ...state.shapes.map((s) => parseInt(s.id.replace(/\D/g, ""), 10) || 0),
    );
    // run once on mount only — persisted ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(
      parseSuspend(suspendData) ?? {
        shapes: [],
        tool: initialTool,
        submitted: false,
        attempts: 0,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (!onPersist) return;
    // Persist `submitted` + `attempts` too. Without these, a learner who
    // submits and then resumes from SCORM lands back in the unsubmitted
    // state with their shapes restored — they can keep drawing and
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
      color: "var(--color-primary)",
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

  const submit = () => {
    if (state.submitted) return;
    const score = computeScore(state.shapes, config, scoring.mode === "all-or-nothing");
    setState((s) => ({ ...s, submitted: true, attempts: s.attempts + 1 }));
    onSubmit({
      ...score,
      suspendData: JSON.stringify({ shapes: state.shapes }),
    });
  };

  const tryAgain = () => {
    setState((s) => ({ ...s, submitted: false, shapes: [] }));
  };

  const submitLabel = config.ui?.submitButtonLabel ?? "Submit";
  const clearLabel = config.ui?.clearButton ?? "Clear all";

  return (
    <div className="kukui-ia">
      <article className="kukui-ia__card" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-ia__title">
          {config.title}
        </HeadingTag>
        <SafeHtml className="kukui-ia__prompt" html={config.prompt} />

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
            <div className="kukui-ia__empty" role="status">
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
              <marker
                id={`${headingId}-arrow`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
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
                  <span className="kukui-ia__shape-num">{i + 1}.</span>
                  <span className="kukui-ia__shape-kind">{s.kind}</span>
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
                Submitted — {state.shapes.length} annotation
                {state.shapes.length === 1 ? "" : "s"} recorded.
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

type ScoreOut = { raw: number; max: number; success: boolean };

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
  // Score by IoU. For each expected region, find the best learner shape
  // (rect or circle) that covers it; >= 0.5 IoU counts as correct.
  let hits = 0;
  for (const ex of expected) {
    const exRect = ex.rect;
    let best = 0;
    for (const sh of shapes) {
      if (sh.kind !== "rectangle" && sh.kind !== "circle") continue;
      const [a, b] = sh.points;
      if (!a || !b) continue;
      const lx = Math.min(a.x, b.x);
      const ly = Math.min(a.y, b.y);
      const lw = Math.abs(a.x - b.x);
      const lh = Math.abs(a.y - b.y);
      const iou = computeIoU(
        { x: lx, y: ly, w: lw, h: lh },
        { x: exRect.x, y: exRect.y, w: exRect.w, h: exRect.h },
      );
      if (iou > best) best = iou;
    }
    if (best >= 0.5) hits += 1;
  }
  const max = expected.length;
  if (singlePoint) {
    const all = hits === max;
    return { raw: all ? 1 : 0, max: 1, success: all };
  }
  return { raw: hits, max, success: hits === max };
}

function computeIoU(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number {
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

function parseSuspend(s: string | undefined): State | null {
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
      if (
        raw &&
        typeof raw === "object" &&
        typeof (raw as AnnotationShape).id === "string" &&
        typeof (raw as AnnotationShape).kind === "string" &&
        Array.isArray((raw as AnnotationShape).points)
      ) {
        shapes.push(raw as AnnotationShape);
      }
    }
    return {
      shapes,
      tool: "rectangle",
      submitted: parsed.submitted === true,
      attempts: typeof parsed.attempts === "number" ? parsed.attempts : 0,
    };
  } catch {
    return null;
  }
}
