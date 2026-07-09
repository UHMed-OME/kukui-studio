import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { ConceptMapConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { bandMessage, percentage, resolveScoring } from "@kukui/core/scoring";
import {
  ActivityHeader,
  SafeHtml,
  StatusBadge,
  DotIcon,
  CheckIcon,
} from "@kukui/core";
import "./Component.css";

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
 * Scoring routes through `resolveScoring(config)` (single source for retry /
 * pass threshold / bands / mode), same as multiple-choice. Expected nodes are
 * matched by id for palette/seed nodes, with a normalized-label fallback for
 * learner-typed free-text nodes (their ids are generated at runtime).
 *
 * Deferred for the v1 of this activity:
 * - Edge label editing (we keep `label?` in the data shape so authors can
 *   express expected edge labels for scoring, but learners can't add labels
 *   to their own edges yet)
 * - Multi-select / box select
 * - Undo / redo
 * - Real-time multi-learner sync (planned for Phase 3 / Live)
 */
export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<ConceptMapConfig>) {
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
    setPendingPalette(null);
    setFreeTextOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (!onPersist) return;
    onPersist(serializeState(state));
  }, [state, onPersist]);

  const submitted = state.stage === "submitted";

  // Effective scoring view — reads config.scoring (Scoring tab) with a legacy
  // fallback to behaviour.enableRetry etc. Never read those knobs directly.
  const scoring = useMemo(
    // Default pass threshold is 100 so legacy configs (no scoring block)
    // keep the original "success means every expected item present"
    // semantics; an authored scoring.passPercentage still wins.
    () => resolveScoring(config, { mode: "points", passPercentage: 100 }),
    [config],
  );

  // Header badge: completion-only — "Complete" once the map is submitted,
  // "In progress" while the learner is still building. Additive; leaves the
  // heading/roles untouched.
  const headerBadge = submitted ? (
    <StatusBadge tone="success" icon={<CheckIcon />}>
      Complete
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral" icon={<DotIcon />}>
      In progress
    </StatusBadge>
  );

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
  };

  const onCanvasPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.kind === "move") {
      setDrag({ kind: "idle" });
      return;
    }
    // Palette drop: pointer pressed on a palette chip, released over the
    // canvas. No canvas *click* fires for that gesture (the click target is
    // the common ancestor of pointerdown/pointerup targets, which is outside
    // the canvas), so placement must happen here at the pointerup coords.
    if (pendingPalette) {
      placeFromPalette(pendingPalette, e.clientX, e.clientY);
      setPendingPalette(null);
    }
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

  const onEdgeKeyDown = (edgeId: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
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
      // Inline modal rather than window.prompt() — some SCORM hosts
      // (notably D2L Brightspace's sandboxed iframe) block native
      // prompts silently, returning null and giving the learner no
      // feedback that the action did nothing.
      freeTextTriggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setFreeTextOpen(true);
    } else {
      // No free text: nudge focus to the palette area.
      paletteListRef.current?.querySelector("button")?.focus();
    }
  };

  const closeFreeText = () => {
    setFreeTextOpen(false);
    // Return focus to whatever opened the modal (WCAG 2.4.3 focus order).
    freeTextTriggerRef.current?.focus();
    freeTextTriggerRef.current = null;
  };

  const submitFreeText = (label: string) => {
    addFreeTextNode(label);
    closeFreeText();
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
  // pointer-down on the palette button to start a "pending placement"; the
  // concept is placed either where the pointer is released over the canvas
  // (drag-drop gesture, handled in onCanvasPointerUp) or at canvas centre when
  // the press completes as a plain click on the chip (keyboard / tap fallback,
  // handled in onPaletteAddClick).
  const [pendingPalette, setPendingPalette] = useState<string | null>(null);
  const paletteListRef = useRef<HTMLDivElement>(null);
  // Inline "Add free-text node" modal — replaces window.prompt(), which
  // some SCORM hosts (Brightspace sandboxed iframes) block silently.
  const [freeTextOpen, setFreeTextOpen] = useState(false);
  const freeTextTriggerRef = useRef<HTMLElement | null>(null);

  const onPalettePointerDown = (paletteId: string) => () => {
    if (submitted) return;
    setPendingPalette(paletteId);
  };

  // While a palette item is "pending", the next canvas click places it.
  // (Fallback path — the common gestures are handled by onCanvasPointerUp
  // and onPaletteAddClick; this catches pointer-event-less environments.)
  const onCanvasClick = (e: MouseEvent<HTMLDivElement>) => {
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
    // Keyboard / plain-click fallback: place at canvas centre. Always clear
    // the pending placement started by this press's pointerdown — otherwise
    // the canvas stays stuck in "is-placing" mode after the node is placed.
    setPendingPalette(null);
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

  // Correct-item counts against the expected map (id or normalized-label
  // match for nodes; undirected match for edges). `total === 0` means the
  // author provided no answer key → completion-only.
  const graded = useMemo(
    () => gradeMap(state.nodes, state.edges, config),
    [state.nodes, state.edges, config],
  );
  const hasExpected = graded.total > 0;

  const submit = () => {
    if (state.stage !== "answering") return;

    let raw: number;
    let max: number;
    let success: boolean;
    if (!hasExpected || scoring.mode === "completion") {
      // Completion semantics — submitting a non-empty map is success. (The
      // Submit button is disabled until at least one node exists.)
      raw = 1;
      max = 1;
      success = true;
    } else if (scoring.mode === "all-or-nothing") {
      const complete = graded.correct === graded.total;
      raw = complete ? 1 : 0;
      max = 1;
      success = complete;
    } else {
      raw = graded.correct;
      max = graded.total;
      // Unrounded comparison: percentage() rounds, which could nudge a
      // just-below-threshold score over the line.
      success = (raw / max) * 100 >= scoring.passPercentage;
    }

    const next: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    setState(next);
    onSubmit({
      raw,
      max,
      success,
      suspendData: serializeState(next),
    });
  };

  const tryAgain = () => {
    setState({ ...initial, attempts: state.attempts });
    setSelection(null);
    setEdgeFromId(null);
    setTool("select");
  };

  const submitLabel = config.ui?.submitButtonLabel ?? "Submit";

  const pct = hasExpected ? percentage({ raw: graded.correct, max: graded.total }) : 100;
  const banner = submitted ? bandMessage(scoring.bands, pct) : null;
  const showScoreLine = submitted && hasExpected && scoring.mode !== "completion";

  // Lookup helpers
  const nodeById = useMemo(() => {
    const m: Record<string, NodeShape> = {};
    for (const n of state.nodes) m[n.id] = n;
    return m;
  }, [state.nodes]);

  const paletteRemaining = (config.availableConcepts ?? []).filter(
    (c) => !state.nodes.some((n) => n.id === c.id),
  );

  const expectedNodeEntries = config.expected?.nodes ?? [];
  const expectedEdgeKeys = new Set(
    (config.expected?.edges ?? []).map((e) => undirectedKey(e.from, e.to)),
  );

  return (
    <div className="kukui-cm">
      <article className="kukui-cm__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          prompt={config.prompt ? <SafeHtml html={config.prompt} /> : undefined}
          badge={headerBadge}
        />

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
            onPointerCancel={() => {
              if (drag.kind === "move") setDrag({ kind: "idle" });
            }}
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
            {/* Edges as a separate keyboard-focusable list. Each item is
              * visually hidden until focused, then reveals as a chip so the
              * focus indicator is actually visible (WCAG 2.4.7). */}
            <ul className="kukui-cm__edge-list">
              {state.edges.map((e) => {
                const a = nodeById[e.from];
                const b = nodeById[e.to];
                if (!a || !b) return null;
                const isSelected = selection?.kind === "edge" && selection.id === e.id;
                return (
                  <li key={e.id}>
                    {/* Real <button> so Enter/Space select the edge; Delete removes it. */}
                    <button
                      type="button"
                      className={["kukui-cm__edge-handle", isSelected ? "is-selected" : ""]
                        .filter(Boolean)
                        .join(" ")}
                      aria-label={`Edge from ${a.label} to ${b.label}. Press Delete to remove.`}
                      onClick={() => onEdgeClick(e.id)}
                      onKeyDown={onEdgeKeyDown(e.id)}
                      disabled={submitted}
                    >
                      {a.label} → {b.label}
                    </button>
                  </li>
                );
              })}
            </ul>
            {state.nodes.map((n) => {
              const isSelected = selection?.kind === "node" && selection.id === n.id;
              const isEdgeStart = edgeFromId === n.id;
              const correct =
                submitted &&
                expectedNodeEntries.some((exp) => matchesExpectedNode(exp, n));
              const incorrect = submitted && expectedNodeEntries.length > 0 && !correct;
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
                    // No click-after-drag suppression needed: pointerdown
                    // already selected this node, and edge mode ignores
                    // pointer drags — the trailing click after a drag is a
                    // harmless re-selection.
                    ev.stopPropagation();
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
          {submitted ? feedbackMessage(graded, hasExpected) : ""}
        </div>

        <div className="kukui-cm__actions">
          {submitted ? (
            <>
              {showScoreLine ? (
                <output className="kukui-cm__score">
                  {graded.correct} / {graded.total}
                  {banner ? <span className="kukui-cm__band"> — {banner}</span> : null}
                </output>
              ) : null}
              {scoring.enableRetry ? (
                <button type="button" className="kukui-cm__secondary" onClick={tryAgain}>
                  Try again
                </button>
              ) : null}
            </>
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
      {freeTextOpen ? (
        <FreeTextModal onAdd={submitFreeText} onCancel={closeFreeText} />
      ) : null}
    </div>
  );
}

/**
 * Inline "Add free-text node" dialog. Owns its draft text, autofocuses the
 * input on mount, traps Tab inside itself (simple first/last cycle), and
 * closes on Escape. The parent restores focus to the trigger on close.
 */
function FreeTextModal({
  onAdd,
  onCancel,
}: {
  onAdd: (label: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== "Tab") return;
    // Simple focus trap: cycle Tab / Shift+Tab between the first and last
    // focusable controls inside the dialog.
    const focusables = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>(
        "input, button:not(:disabled)",
      ) ?? [],
    );
    if (focusables.length === 0) return;
    const first = focusables[0] as HTMLElement;
    const last = focusables[focusables.length - 1] as HTMLElement;
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !containerRef.current?.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !containerRef.current?.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="kukui-cm__modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Add free-text node"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={onKeyDown}
    >
      <div className="kukui-cm__modal" ref={containerRef}>
        <label className="kukui-cm__modal-label" htmlFor="kukui-cm-free-text">
          Node label
        </label>
        <input
          ref={inputRef}
          id="kukui-cm-free-text"
          type="text"
          className="kukui-cm__modal-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (draft.trim()) onAdd(draft);
            }
          }}
          maxLength={120}
          placeholder="e.g. Photosynthesis"
        />
        <div className="kukui-cm__modal-actions">
          <button type="button" className="kukui-cm__secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="kukui-cm__primary"
            onClick={() => onAdd(draft)}
            disabled={!draft.trim()}
          >
            Add node
          </button>
        </div>
      </div>
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

function normalizeLabel(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Expected-node matching: palette/seed nodes match by id; learner-typed
 * free-text nodes get generated runtime ids that can never equal the
 * authored entry, so fall back to a normalized (trimmed, lowercased)
 * label comparison.
 */
function matchesExpectedNode(expected: string, node: NodeShape): boolean {
  return node.id === expected || normalizeLabel(node.label) === normalizeLabel(expected);
}

/** Count expected items (nodes + undirected edges) present on the canvas. */
function gradeMap(
  nodes: NodeShape[],
  edges: EdgeShape[],
  config: ConceptMapConfig,
): { correct: number; total: number } {
  const expectedNodes = config.expected?.nodes ?? [];
  const expectedEdges = config.expected?.edges ?? [];
  const correctNodes = expectedNodes.filter((exp) =>
    nodes.some((n) => matchesExpectedNode(exp, n)),
  ).length;
  const correctEdges = expectedEdges.filter((eExp) =>
    edges.some(
      (e) =>
        (e.from === eExp.from && e.to === eExp.to) ||
        (e.from === eExp.to && e.to === eExp.from),
    ),
  ).length;
  return {
    correct: correctNodes + correctEdges,
    total: expectedNodes.length + expectedEdges.length,
  };
}

function feedbackMessage(
  graded: { correct: number; total: number },
  hasExpected: boolean,
): string {
  if (!hasExpected) return "Map submitted.";
  return `${graded.correct} of ${graded.total} expected items captured.`;
}

function serializeState(state: State): string {
  return JSON.stringify({
    stage: state.stage,
    attempts: state.attempts,
    nodes: state.nodes,
    edges: state.edges,
  });
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as {
      stage?: unknown;
      attempts?: unknown;
      nodes?: NodeShape[];
      edges?: EdgeShape[];
    };
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
    // Round-trip stage + attempts so a submitted learner resumes submitted
    // (not silently re-opened for another attempt).
    return {
      stage: parsed.stage === "submitted" ? "submitted" : "answering",
      nodes: validNodes,
      edges: validEdges,
      attempts:
        typeof parsed.attempts === "number" && Number.isFinite(parsed.attempts)
          ? Math.max(0, Math.floor(parsed.attempts))
          : 0,
    };
  } catch {
    return null;
  }
}
