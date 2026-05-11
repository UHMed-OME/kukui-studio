import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { ConceptMapConfig } from "@kukui/schemas/concept-map";
import type { ActivityProps } from "../../types.js";
import { SafeHtml } from "../../safe-html.js";
import "./ConceptMap.css";

type NodeShape = { id: string; label: string; position: { x: number; y: number } };
type EdgeShape = { id: string; from: string; to: string; label?: string };

type Stage = "answering" | "submitted";

type State = {
  stage: Stage;
  nodes: NodeShape[];
  edges: EdgeShape[];
  attempts: number;
};

type DragState =
  | { kind: "idle" }
  | {
      kind: "move";
      pointerId: number;
      nodeId: string;
      offsetX: number;
      offsetY: number;
      didMove: boolean;
    };

const NODE_NUDGE = 0.02; // 2 % per arrow press

/**
 * Concept Map / Node-Link Builder — async v1.
 *
 * Learners place nodes on a canvas, connect them with edges, and submit. Nodes
 * come from one of three sources: pre-placed seed nodes (always on canvas),
 * the palette of `availableConcepts` (drag from the side rail onto the canvas),
 * or free-text typed via the toolbar's "+ Node" button when
 * `behaviour.allowFreeText` is on. Edges are added via "+ Edge" mode: click
 * the toolbar's button, then click two nodes in succession.
 *
 * Coordinates are normalized 0..1 against the canvas rect — survives a resize
 * without recomputing pixel offsets. State changes flow through `setState`,
 * which also fires `onPersist` for SCORM resume.
 *
 * Deferred for the v1 of this activity:
 * - Edge label editing (we keep `label?` in the data shape so authors can
 *   express expected edge labels for scoring, but learners can't add labels
 *   to their own edges yet)
 * - Multi-select / box select
 * - Undo / redo
 * - Real-time multi-learner sync (planned for Phase 3 / Live)
 */
export function ConceptMap({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<ConceptMapConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();

  const initial = useMemo<State>(
    () => ({
      stage: "answering",
      nodes: (config.seedNodes ?? []).map((n) => ({ ...n })),
      edges: [],
      attempts: 0,
    }),
    [config.seedNodes],
  );

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData) ?? initial,
  );

  // UI-only state — not persisted.
  const [tool, setTool] = useState<"select" | "edge">("select");
  const [edgeFromId, setEdgeFromId] = useState<string | null>(null);
  const [selection, setSelection] = useState<
    { kind: "node"; id: string } | { kind: "edge"; id: string } | null
  >(null);
  const [drag, setDrag] = useState<DragState>({ kind: "idle" });

  const canvasRef = useRef<HTMLDivElement>(null);

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(parseSuspend(suspendData) ?? initial);
    setTool("select");
    setEdgeFromId(null);
    setSelection(null);
    setDrag({ kind: "idle" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify({ nodes: state.nodes, edges: state.edges }));
  }, [state.nodes, state.edges, onPersist]);

  const submitted = state.stage === "submitted";

  const toNormalized = useCallback((clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { x: 0.5, y: 0.5 };
    return {
      x: clamp01((clientX - r.left) / r.width),
      y: clamp01((clientY - r.top) / r.height),
    };
  }, []);

  /** Place a new node from the palette onto the canvas at the given client coords. */
  const placeFromPalette = (paletteId: string, clientX: number, clientY: number) => {
    if (submitted) return;
    const concept = config.availableConcepts?.find((c) => c.id === paletteId);
    if (!concept) return;
    // If this concept is already on the canvas, don't duplicate it.
    if (state.nodes.some((n) => n.id === paletteId)) return;
    const { x, y } = toNormalized(clientX, clientY);
    setState((s) => ({
      ...s,
      nodes: [...s.nodes, { id: paletteId, label: concept.label, position: { x, y } }],
    }));
  };

  /** Add a free-text node. Centers it; learner moves it after. */
  const addFreeTextNode = (label: string) => {
    if (submitted) return;
    const trimmed = label.trim();
    if (!trimmed) return;
    const id = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setState((s) => ({
      ...s,
      nodes: [...s.nodes, { id, label: trimmed, position: { x: 0.5, y: 0.5 } }],
    }));
  };

  const moveNode = (nodeId: string, dx: number, dy: number) => {
    if (submitted) return;
    setState((s) => ({
      ...s,
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              position: {
                x: clamp01(n.position.x + dx),
                y: clamp01(n.position.y + dy),
              },
            }
          : n,
      ),
    }));
  };

  const setNodePosition = (nodeId: string, x: number, y: number) => {
    if (submitted) return;
    setState((s) => ({
      ...s,
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, position: { x: clamp01(x), y: clamp01(y) } } : n,
      ),
    }));
  };

  const deleteNode = (nodeId: string) => {
    if (submitted) return;
    setState((s) => ({
      ...s,
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
    }));
    setSelection(null);
    setEdgeFromId(null);
  };

  const deleteEdge = (edgeId: string) => {
    if (submitted) return;
    setState((s) => ({ ...s, edges: s.edges.filter((e) => e.id !== edgeId) }));
    setSelection(null);
  };

  const addEdge = (fromId: string, toId: string) => {
    if (submitted || fromId === toId) return;
    // Don't duplicate an existing edge between the same two endpoints
    // (treat as undirected for de-duplication purposes).
    const existing = state.edges.some(
      (e) =>
        (e.from === fromId && e.to === toId) ||
        (e.from === toId && e.to === fromId),
    );
    if (existing) return;
    const id = `e-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setState((s) => ({ ...s, edges: [...s.edges, { id, from: fromId, to: toId }] }));
  };

  const onNodeClick = (nodeId: string) => {
    if (submitted) return;
    if (tool === "edge") {
      if (edgeFromId === null) {
        setEdgeFromId(nodeId);
      } else if (edgeFromId === nodeId) {
        // Click the same node twice → cancel
        setEdgeFromId(null);
      } else {
        addEdge(edgeFromId, nodeId);
        setEdgeFromId(null);
        setTool("select");
      }
      return;
    }
    setSelection({ kind: "node", id: nodeId });
  };

  const onEdgeClick = (edgeId: string) => {
    if (submitted) return;
    setSelection({ kind: "edge", id: edgeId });
  };

  const onNodePointerDown = (nodeId: string) => (e: PointerEvent<HTMLButtonElement>) => {
    if (submitted) return;
    if (tool === "edge") return; // edge mode handles via click
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setDrag({
      kind: "move",
      pointerId: e.pointerId,
      nodeId,
      offsetX: x - node.position.x,
      offsetY: y - node.position.y,
      didMove: false,
    });
    setSelection({ kind: "node", id: nodeId });
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* JSDOM stub may not implement setPointerCapture */
    }
  };

  const onCanvasPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.kind !== "move") return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    const nx = clamp01(x - drag.offsetX);
    const ny = clamp01(y - drag.offsetY);
    setNodePosition(drag.nodeId, nx, ny);
    if (!drag.didMove) setDrag({ ...drag, didMove: true });
  };

  const onCanvasPointerUp = () => {
    if (drag.kind === "move") setDrag({ kind: "idle" });
  };

  const onNodeKeyDown = (nodeId: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (submitted) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveNode(nodeId, 0, -NODE_NUDGE);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveNode(nodeId, 0, NODE_NUDGE);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveNode(nodeId, -NODE_NUDGE, 0);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      moveNode(nodeId, NODE_NUDGE, 0);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteNode(nodeId);
    }
  };

  const onEdgeKeyDown = (edgeId: string) => (e: KeyboardEvent<SVGElement>) => {
    if (submitted) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteEdge(edgeId);
    }
  };

  // Toolbar handlers
  const onAddNodeClick = () => {
    if (submitted) return;
    if (config.behaviour?.allowFreeText) {
      // eslint-disable-next-line no-alert
      const label = window.prompt("Node label:");
      if (label) addFreeTextNode(label);
    } else {
      // No free text: nudge focus to the palette area.
      paletteListRef.current?.querySelector("button")?.focus();
    }
  };

  const onToggleEdgeMode = () => {
    if (submitted) return;
    setTool((t) => (t === "edge" ? "select" : "edge"));
    setEdgeFromId(null);
  };

  const onDeleteSelectedClick = () => {
    if (submitted || !selection) return;
    if (selection.kind === "node") deleteNode(selection.id);
    else deleteEdge(selection.id);
  };

  const onClearAllClick = () => {
    if (submitted) return;
    setState((s) => ({ ...s, nodes: [], edges: [] }));
    setSelection(null);
    setEdgeFromId(null);
    setTool("select");
  };

  // Palette → canvas placement: drop a palette concept onto the canvas. We use
  // pointer-down on the palette button to start a "pending placement"; once
  // the user lifts pointer over the canvas, we place at that location.
  const [pendingPalette, setPendingPalette] = useState<string | null>(null);
  const paletteListRef = useRef<HTMLDivElement>(null);

  const onPalettePointerDown = (paletteId: string) => () => {
    if (submitted) return;
    setPendingPalette(paletteId);
  };

  // While a palette item is "pending", the next canvas click places it.
  const onCanvasClick = (e: PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (pendingPalette) {
      placeFromPalette(pendingPalette, e.clientX, e.clientY);
      setPendingPalette(null);
      return;
    }
    // Click on empty canvas clears selection and edge-mode pending start.
    if (e.target === canvasRef.current) {
      setSelection(null);
      setEdgeFromId(null);
    }
  };

  const onPaletteAddClick = (paletteId: string) => () => {
    // Keyboard fallback: place at canvas centre.
    if (submitted) return;
    const concept = config.availableConcepts?.find((c) => c.id === paletteId);
    if (!concept) return;
    if (state.nodes.some((n) => n.id === paletteId)) return;
    setState((s) => ({
      ...s,
      nodes: [
        ...s.nodes,
        { id: paletteId, label: concept.label, position: { x: 0.5, y: 0.5 } },
      ],
    }));
  };

  const submit = () => {
    if (state.stage !== "answering") return;
    const expectedNodes = config.expected?.nodes ?? [];
    const expectedEdges = config.expected?.edges ?? [];

    let raw = 0;
    let max = 0;
    let success = true;

    if (expectedNodes.length > 0 || expectedEdges.length > 0) {
      const presentNodeIds = new Set(state.nodes.map((n) => n.id));
      const correctNodes = expectedNodes.filter((id) => presentNodeIds.has(id)).length;
      const correctEdges = expectedEdges.filter((eExp) =>
        state.edges.some(
          (e) =>
            (e.from === eExp.from && e.to === eExp.to) ||
            (e.from === eExp.to && e.to === eExp.from),
        ),
      ).length;
      raw = correctNodes + correctEdges;
      max = expectedNodes.length + expectedEdges.length;
      success = raw === max;
    } else {
      // Completion-only — any submission is success once at least one node exists.
      raw = state.nodes.length > 0 ? 1 : 0;
      max = 1;
      success = raw === 1;
    }

    const next: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    setState(next);
    onSubmit({
      raw,
      max,
      success,
      suspendData: JSON.stringify({ nodes: next.nodes, edges: next.edges }),
    });
  };

  const tryAgain = () => {
    setState({ ...initial, attempts: state.attempts });
    setSelection(null);
    setEdgeFromId(null);
    setTool("select");
  };

  const submitLabel = config.ui?.submitButtonLabel ?? "Submit";

  // Lookup helpers
  const nodeById = useMemo(() => {
    const m: Record<string, NodeShape> = {};
    for (const n of state.nodes) m[n.id] = n;
    return m;
  }, [state.nodes]);

  const paletteRemaining = (config.availableConcepts ?? []).filter(
    (c) => !state.nodes.some((n) => n.id === c.id),
  );

  const expectedNodeIds = new Set(config.expected?.nodes ?? []);
  const expectedEdgeKeys = new Set(
    (config.expected?.edges ?? []).map((e) => undirectedKey(e.from, e.to)),
  );

  return (
    <div className="kukui-cm">
      <article className="kukui-cm__card" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-cm__title">
          {config.title}
        </HeadingTag>
        <SafeHtml html={config.prompt} className="kukui-cm__prompt" />

        <div className="kukui-cm__toolbar" role="toolbar" aria-label="Concept map tools">
          <button
            type="button"
            className="kukui-cm__tool"
            onClick={onAddNodeClick}
            disabled={submitted}
            aria-label="Add a node"
          >
            + Node
          </button>
          <button
            type="button"
            className={[
              "kukui-cm__tool",
              tool === "edge" ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={onToggleEdgeMode}
            disabled={submitted}
            aria-pressed={tool === "edge"}
            aria-label={tool === "edge" ? "Cancel edge drawing" : "Draw an edge between two nodes"}
          >
            + Edge
          </button>
          <button
            type="button"
            className="kukui-cm__tool"
            onClick={onDeleteSelectedClick}
            disabled={submitted || !selection}
            aria-label="Delete the selected node or edge"
          >
            Delete
          </button>
          <button
            type="button"
            className="kukui-cm__tool"
            onClick={onClearAllClick}
            disabled={submitted || (state.nodes.length === 0 && state.edges.length === 0)}
            aria-label="Clear all nodes and edges"
          >
            Clear all
          </button>
        </div>

        {tool === "edge" ? (
          <p className="kukui-cm__hint" role="status" aria-live="polite">
            {edgeFromId === null
              ? "Edge mode: click a node to start an edge."
              : `Edge mode: click another node to connect it to “${nodeById[edgeFromId]?.label ?? ""}”.`}
          </p>
        ) : null}

        <div className="kukui-cm__layout">
          <div
            ref={canvasRef}
            className={[
              "kukui-cm__canvas",
              tool === "edge" ? "is-edge-mode" : "",
              pendingPalette ? "is-placing" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="application"
            aria-label="Concept map canvas"
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerUp}
            onClick={onCanvasClick}
          >
            <svg className="kukui-cm__edges" aria-hidden="true">
              {state.edges.map((e) => {
                const a = nodeById[e.from];
                const b = nodeById[e.to];
                if (!a || !b) return null;
                const isSelected = selection?.kind === "edge" && selection.id === e.id;
                const correct =
                  submitted && expectedEdgeKeys.has(undirectedKey(e.from, e.to));
                const incorrect = submitted && !correct;
                return (
                  <g key={e.id}>
                    {/* Wide invisible line for easier hit-testing */}
                    <line
                      className="kukui-cm__edge-hit"
                      x1={`${a.position.x * 100}%`}
                      y1={`${a.position.y * 100}%`}
                      x2={`${b.position.x * 100}%`}
                      y2={`${b.position.y * 100}%`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEdgeClick(e.id);
                      }}
                    />
                    <line
                      className={[
                        "kukui-cm__edge",
                        isSelected ? "is-selected" : "",
                        submitted && correct ? "is-correct" : "",
                        submitted && incorrect ? "is-incorrect" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      x1={`${a.position.x * 100}%`}
                      y1={`${a.position.y * 100}%`}
                      x2={`${b.position.x * 100}%`}
                      y2={`${b.position.y * 100}%`}
                    />
                  </g>
                );
              })}
            </svg>
            {/* Edges as a separate keyboard-focusable list (off-canvas, for AT) */}
            <ul className="kukui-cm__edge-list">
              {state.edges.map((e) => {
                const a = nodeById[e.from];
                const b = nodeById[e.to];
                if (!a || !b) return null;
                const isSelected = selection?.kind === "edge" && selection.id === e.id;
                return (
                  <li key={e.id}>
                    {/* This is keyboard-focusable so users can press Delete on a focused edge */}
                    <span
                      role="button"
                      tabIndex={submitted ? -1 : 0}
                      className={["kukui-cm__edge-handle", isSelected ? "is-selected" : ""]
                        .filter(Boolean)
                        .join(" ")}
                      aria-label={`Edge from ${a.label} to ${b.label}. Press Delete to remove.`}
                      onClick={() => onEdgeClick(e.id)}
                      onKeyDown={(ev) =>
                        onEdgeKeyDown(e.id)(
                          ev as unknown as KeyboardEvent<SVGElement>,
                        )
                      }
                    >
                      {a.label} → {b.label}
                    </span>
                  </li>
                );
              })}
            </ul>
            {state.nodes.map((n) => {
              const isSelected = selection?.kind === "node" && selection.id === n.id;
              const isEdgeStart = edgeFromId === n.id;
              const correct = submitted && expectedNodeIds.has(n.id);
              const incorrect = submitted && expectedNodeIds.size > 0 && !correct;
              const style: CSSProperties = {
                left: `${n.position.x * 100}%`,
                top: `${n.position.y * 100}%`,
              };
              return (
                <button
                  key={n.id}
                  type="button"
                  className={[
                    "kukui-cm__node",
                    isSelected ? "is-selected" : "",
                    isEdgeStart ? "is-edge-start" : "",
                    submitted && correct ? "is-correct" : "",
                    submitted && incorrect ? "is-incorrect" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={style}
                  data-node-id={n.id}
                  onPointerDown={onNodePointerDown(n.id)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (drag.kind === "move" && drag.didMove) return;
                    onNodeClick(n.id);
                  }}
                  onKeyDown={onNodeKeyDown(n.id)}
                  aria-label={`Node ${n.label}. Arrow keys move, Delete removes.`}
                  disabled={submitted}
                >
                  <span className="kukui-cm__node-label">{n.label}</span>
                </button>
              );
            })}
          </div>

          {(config.availableConcepts ?? []).length > 0 ? (
            <aside className="kukui-cm__palette" aria-label="Concept palette">
              <h3 className="kukui-cm__palette-title">Concepts</h3>
              <div className="kukui-cm__palette-list" ref={paletteListRef}>
                {paletteRemaining.length === 0 ? (
                  <p className="kukui-cm__palette-empty">All concepts placed.</p>
                ) : (
                  paletteRemaining.map((c) => (
                    <div key={c.id} className="kukui-cm__palette-row">
                      <button
                        type="button"
                        className={[
                          "kukui-cm__palette-chip",
                          pendingPalette === c.id ? "is-pending" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onPointerDown={onPalettePointerDown(c.id)}
                        onClick={onPaletteAddClick(c.id)}
                        disabled={submitted}
                        aria-label={`Add concept ${c.label} to canvas`}
                      >
                        {c.label}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </aside>
          ) : null}
        </div>

        <div
          className={["kukui-cm__feedback", submitted ? "is-visible" : ""]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {submitted ? feedbackMessage(state, config) : ""}
        </div>

        <div className="kukui-cm__actions">
          {submitted ? (
            config.behaviour?.enableRetry ? (
              <button type="button" className="kukui-cm__secondary" onClick={tryAgain}>
                Try again
              </button>
            ) : null
          ) : (
            <button
              type="button"
              className="kukui-cm__primary"
              onClick={submit}
              disabled={state.nodes.length === 0}
            >
              {submitLabel}
            </button>
          )}
        </div>
      </article>
    </div>
  );
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function undirectedKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function feedbackMessage(state: State, config: ConceptMapConfig): string {
  const expectedNodes = config.expected?.nodes ?? [];
  const expectedEdges = config.expected?.edges ?? [];
  if (expectedNodes.length === 0 && expectedEdges.length === 0) {
    return "Map submitted.";
  }
  const presentNodeIds = new Set(state.nodes.map((n) => n.id));
  const correctNodes = expectedNodes.filter((id) => presentNodeIds.has(id)).length;
  const correctEdges = expectedEdges.filter((eExp) =>
    state.edges.some(
      (e) =>
        (e.from === eExp.from && e.to === eExp.to) ||
        (e.from === eExp.to && e.to === eExp.from),
    ),
  ).length;
  const total = expectedNodes.length + expectedEdges.length;
  const correct = correctNodes + correctEdges;
  return `${correct} of ${total} expected items captured.`;
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as { nodes?: NodeShape[]; edges?: EdgeShape[] };
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    const validNodes: NodeShape[] = [];
    for (const n of parsed.nodes) {
      if (
        n &&
        typeof n.id === "string" &&
        typeof n.label === "string" &&
        n.position &&
        typeof n.position.x === "number" &&
        typeof n.position.y === "number"
      ) {
        validNodes.push({
          id: n.id,
          label: n.label,
          position: { x: clamp01(n.position.x), y: clamp01(n.position.y) },
        });
      }
    }
    const validIds = new Set(validNodes.map((n) => n.id));
    const validEdges: EdgeShape[] = [];
    for (const e of parsed.edges) {
      if (
        e &&
        typeof e.id === "string" &&
        typeof e.from === "string" &&
        typeof e.to === "string" &&
        validIds.has(e.from) &&
        validIds.has(e.to)
      ) {
        validEdges.push({
          id: e.id,
          from: e.from,
          to: e.to,
          label: typeof e.label === "string" ? e.label : undefined,
        });
      }
    }
    return {
      stage: "answering",
      nodes: validNodes,
      edges: validEdges,
      attempts: 0,
    };
  } catch {
    return null;
  }
}
