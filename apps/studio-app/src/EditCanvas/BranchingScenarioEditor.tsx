import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { roundCoord } from "./zorder.js";
import { DRAG_THRESHOLD_PX } from "./minRect.js";
import { InlineEdit } from "./InlineEdit.js";
import { newAssetId, putSlideAsset, loadSlideAsset } from "../slides/slideAssetStore.js";

/**
 * Visual node-graph editor for the branching-scenario activity.
 *
 * The activity is a decision tree; the nested RJSF form makes trees painful to
 * author, so this canvas is the working path. Left column: a graph of node
 * cards positioned by normalized (0..1) coordinates, with directed SVG arrows
 * drawn from each node to the target of each of its choices. Right column: a
 * sticky rail that inspects the selected node (prompt, image, start / terminal
 * controls, choices or an end screen) or, when nothing is selected, a graph
 * panel with the scoring mode and an "Add node" button.
 *
 * Reads the config forgivingly (it can be transiently Zod-invalid mid-edit) and
 * emits a full replacement config through `onChange`. Undo/redo, autosave, and
 * the validation badge live in App.tsx.
 *
 * Node / outcome images follow the course-presentation model: the bytes live in
 * IndexedDB (slideAssetStore) keyed by an `assetId`, the config keeps only the
 * id plus alt and natural dimensions, and ids resolve to object URLs here.
 */

type NodeImage = {
  assetId?: string;
  src?: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
};

type Outcome = {
  score: number;
  success: boolean;
  title?: string;
  message?: string;
  image?: NodeImage;
};

type Choice = {
  id: string;
  text: string;
  nextNodeId: string;
  feedback?: string;
  points?: number;
};

type BNode = {
  id: string;
  prompt: string;
  image?: NodeImage;
  position?: { x: number; y: number };
  choices: Choice[] | null;
  outcome?: Outcome;
};

type ScoreMode = "terminal" | "path";

type BSConfig = {
  nodes?: BNode[];
  startNodeId?: string;
  behaviour?: { enableRetry?: boolean; scoreMode?: ScoreMode };
  title?: string;
  [k: string]: unknown;
};

/** Keyboard nudge step for a focused node (2%). */
const NUDGE = 0.02;

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/** Wrap freshly typed plain text back into the <p>-wrapped HTML the runtime expects. */
function toHtml(text: string): string {
  const t = text.trim();
  return t ? `<p>${t}</p>` : "";
}

function truncate(s: string, max = 42): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function newId(prefix: string, existing: string[]): string {
  let i = existing.length + 1;
  while (existing.includes(`${prefix}-${i}`)) i += 1;
  return `${prefix}-${i}`;
}

function isTerminal(node: BNode): boolean {
  return node.choices == null || node.choices.length === 0;
}

/**
 * Auto-layout for nodes without an explicit `position`: BFS layering from the
 * start node (start = row 0, its choice targets = row 1, and so on). Nodes not
 * reachable from start drop into one extra trailing row. Within a row, x is
 * spread evenly; y falls out of the layer depth. Returned coords are only used
 * for display until the author drags or nudges a node, which persists its
 * position into the config.
 */
function autoLayout(nodes: BNode[], startId: string): Record<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const layer = new Map<string, number>();
  const queue: string[] = [];
  if (byId.has(startId)) {
    layer.set(startId, 0);
    queue.push(startId);
  }
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const node = byId.get(id);
    const l = layer.get(id) ?? 0;
    if (!node || node.choices == null) continue;
    for (const c of node.choices) {
      if (byId.has(c.nextNodeId) && !layer.has(c.nextNodeId)) {
        layer.set(c.nextNodeId, l + 1);
        queue.push(c.nextNodeId);
      }
    }
  }
  let maxLayer = 0;
  layer.forEach((v) => {
    maxLayer = Math.max(maxLayer, v);
  });
  const unreached = nodes.filter((n) => !layer.has(n.id));
  if (unreached.length > 0) {
    const ul = maxLayer + 1;
    unreached.forEach((n) => layer.set(n.id, ul));
    maxLayer = ul;
  }
  const rows = new Map<number, string[]>();
  nodes.forEach((n) => {
    const l = layer.get(n.id) ?? 0;
    if (!rows.has(l)) rows.set(l, []);
    (rows.get(l) as string[]).push(n.id);
  });
  const out: Record<string, { x: number; y: number }> = {};
  const totalLayers = maxLayer + 1;
  rows.forEach((ids, l) => {
    ids.forEach((id, i) => {
      const x = (i + 1) / (ids.length + 1);
      const y = totalLayers <= 1 ? 0.5 : (l + 1) / (totalLayers + 1);
      out[id] = { x: roundCoord(x), y: roundCoord(y) };
    });
  });
  return out;
}

/** Read an image file's natural pixel dimensions (positive fallbacks for jsdom). */
async function readImageMeta(file: Blob): Promise<{ w: number; h: number }> {
  try {
    if (typeof createImageBitmap === "function") {
      const bmp = await createImageBitmap(file);
      const w = bmp.width || 1;
      const h = bmp.height || 1;
      bmp.close?.();
      return { w, h };
    }
  } catch {
    /* fall through to the Image() path */
  }
  return await new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
        if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        resolve({ w: 1, h: 1 });
        if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch {
      resolve({ w: 1, h: 1 });
    }
  });
}

/** Resolve image assetIds to object URLs once each; revoked on unmount. */
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
          /* missing asset — card shows the text label only */
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(
    () => () => {
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
  | {
      mode: "move";
      id: string;
      offX: number;
      offY: number;
      startClientX: number;
      startClientY: number;
      moved: boolean;
      x: number;
      y: number;
    };

/** A pending "click a target node" gesture. */
type PendingConnect =
  | { kind: "node"; sourceId: string }
  | { kind: "choice"; sourceId: string; choiceId: string }
  | null;

export function BranchingScenarioEditor({
  config,
  onChange,
}: {
  config: BSConfig;
  onChange: (next: BSConfig) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const draggedRef = useRef(false);

  const nodes = useMemo<BNode[]>(
    () => (Array.isArray(config.nodes) ? config.nodes : []),
    [config.nodes],
  );
  const startNodeId = typeof config.startNodeId === "string" ? config.startNodeId : "";
  const scoreMode: ScoreMode = config.behaviour?.scoreMode === "path" ? "path" : "terminal";
  const title = typeof config.title === "string" ? config.title : "";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState>({ mode: "none" });
  const [pending, setPending] = useState<PendingConnect>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [railFocusTick, setRailFocusTick] = useState(0);

  const auto = useMemo(() => autoLayout(nodes, startNodeId), [nodes, startNodeId]);
  const resolvePos = (n: BNode): { x: number; y: number } =>
    n.position ?? auto[n.id] ?? { x: 0.5, y: 0.5 };

  const assetIds = useMemo(() => {
    const ids: string[] = [];
    for (const n of nodes) {
      if (n.image?.assetId) ids.push(n.image.assetId);
      if (n.outcome?.image?.assetId) ids.push(n.outcome.image.assetId);
    }
    return ids;
  }, [nodes]);
  const urlMap = useAssetUrlMap(assetIds);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    if (!railFocusTick) return;
    const el = railRef.current?.querySelector<HTMLElement>("input, textarea, select");
    el?.focus();
  }, [railFocusTick]);
  const focusRail = () => setRailFocusTick((t) => t + 1);

  /* ---- config writes ------------------------------------------------------ */

  const setNodes = (next: BNode[], extra: Partial<BSConfig> = {}) =>
    onChange({ ...config, ...extra, nodes: next });

  const patchNode = (id: string, fields: Partial<BNode>) =>
    setNodes(nodes.map((n) => (n.id === id ? { ...n, ...fields } : n)));

  const setStart = (id: string) => onChange({ ...config, startNodeId: id });

  const setScoreMode = (mode: ScoreMode) =>
    onChange({ ...config, behaviour: { ...config.behaviour, scoreMode: mode } });

  /* ---- adding nodes / choices --------------------------------------------- */

  const seedTerminalNode = (
    existingIds: string[],
    pos?: { x: number; y: number },
  ): BNode => ({
    id: newId("node", existingIds),
    prompt: "New outcome",
    choices: [],
    outcome: { score: 0, success: false },
    ...(pos ? { position: pos } : {}),
  });

  const addFirstNode = () => {
    const node: BNode = {
      id: "node-1",
      prompt: "Set the scene, then add choices.",
      choices: [],
      outcome: { score: 0, success: false },
      position: { x: 0.5, y: 0.2 },
    };
    setNodes([node], { startNodeId: node.id });
    setSelectedId(node.id);
  };

  const addNode = () => {
    const node = seedTerminalNode(
      nodes.map((n) => n.id),
      { x: 0.5, y: 0.5 },
    );
    setNodes([...nodes, node]);
    setSelectedId(node.id);
    setNotice(null);
  };

  /** Guardrail: seed a NEW terminal node and link a fresh choice to it, so the
   *  reachable-terminal and resolved-nextNodeId refinements stay satisfied. */
  const addChoice = (sourceId: string) => {
    const source = nodes.find((n) => n.id === sourceId);
    if (!source) return;
    const base = resolvePos(source);
    const pos = {
      x: clamp01(roundCoord(base.x + 0.08)),
      y: clamp01(roundCoord(base.y + 0.16)),
    };
    const target = seedTerminalNode(nodes.map((n) => n.id), pos);
    const choice: Choice = {
      id: newId("choice", (source.choices ?? []).map((c) => c.id)),
      text: "New choice",
      nextNodeId: target.id,
    };
    setNodes([
      ...nodes.map((n) =>
        n.id === sourceId ? { ...n, choices: [...(n.choices ?? []), choice] } : n,
      ),
      target,
    ]);
  };

  /** Link a new choice from source to an existing target node (connect gesture). */
  const linkChoice = (sourceId: string, targetId: string) => {
    const source = nodes.find((n) => n.id === sourceId);
    if (!source) return;
    const choice: Choice = {
      id: newId("choice", (source.choices ?? []).map((c) => c.id)),
      text: "New choice",
      nextNodeId: targetId,
    };
    patchNode(sourceId, { choices: [...(source.choices ?? []), choice] });
  };

  const patchChoice = (nodeId: string, choiceId: string, fields: Partial<Choice>) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.choices == null) return;
    patchNode(nodeId, {
      choices: node.choices.map((c) => (c.id === choiceId ? { ...c, ...fields } : c)),
    });
  };

  const removeChoice = (nodeId: string, choiceId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.choices == null) return;
    patchNode(nodeId, { choices: node.choices.filter((c) => c.id !== choiceId) });
  };

  const setTerminal = (nodeId: string, terminal: boolean) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    if (terminal) {
      patchNode(nodeId, {
        choices: null,
        outcome: node.outcome ?? { score: 0, success: false },
      });
    } else if (isTerminal(node)) {
      // Becoming a decision needs at least one choice; seed one (+ its target).
      addChoice(nodeId);
    } else {
      patchNode(nodeId, { choices: node.choices ?? [] });
    }
  };

  const patchOutcome = (nodeId: string, fields: Partial<Outcome>) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    patchNode(nodeId, {
      outcome: { score: 0, success: false, ...node.outcome, ...fields },
    });
  };

  /* ---- delete -------------------------------------------------------------- */

  const deleteNode = (id: string) => {
    if (nodes.length <= 1) {
      setNotice("A scenario needs at least one step, so this one can't be deleted.");
      return;
    }
    let removedLinks = 0;
    const next = nodes
      .filter((n) => n.id !== id)
      .map((n) => {
        if (n.choices == null) return n;
        const kept = n.choices.filter((c) => c.nextNodeId !== id);
        removedLinks += n.choices.length - kept.length;
        return { ...n, choices: kept };
      });
    const nextStart = startNodeId === id ? next[0]?.id ?? "" : startNodeId;
    setNodes(next, { startNodeId: nextStart });
    setSelectedId(null);
    setPending(null);
    setNotice(
      removedLinks > 0
        ? `Deleted the step and cleared ${removedLinks} choice link${
            removedLinks === 1 ? "" : "s"
          } that pointed to it.`
        : startNodeId === id
          ? `Deleted the start step; "${next[0]?.id ?? ""}" is the new start.`
          : null,
    );
  };

  /* ---- pointer drag ------------------------------------------------------- */

  const toNorm = (clientX: number, clientY: number) => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    const r = board.getBoundingClientRect();
    const w = r.width || 1;
    const h = r.height || 1;
    return {
      x: clamp01((clientX - r.left) / w),
      y: clamp01((clientY - r.top) / h),
    };
  };

  const startNodeDrag = (node: BNode) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    const p = toNorm(e.clientX, e.clientY);
    const pos = resolvePos(node);
    setDrag({
      mode: "move",
      id: node.id,
      offX: p.x - pos.x,
      offY: p.y - pos.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
      x: pos.x,
      y: pos.y,
    });
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture unavailable — board move handler still tracks */
    }
  };

  const onBoardMove = (e: ReactPointerEvent) => {
    if (drag.mode !== "move") return;
    const dxPx = Math.abs(e.clientX - drag.startClientX);
    const dyPx = Math.abs(e.clientY - drag.startClientY);
    const moved = drag.moved || dxPx > DRAG_THRESHOLD_PX || dyPx > DRAG_THRESHOLD_PX;
    const p = toNorm(e.clientX, e.clientY);
    setDrag({
      ...drag,
      moved,
      x: clamp01(p.x - drag.offX),
      y: clamp01(p.y - drag.offY),
    });
  };

  const endDrag = () => {
    if (drag.mode !== "move") return;
    if (drag.moved) {
      draggedRef.current = true;
      patchNode(drag.id, {
        position: { x: roundCoord(drag.x), y: roundCoord(drag.y) },
      });
    }
    setDrag({ mode: "none" });
  };

  /* ---- click / connect ---------------------------------------------------- */

  const onNodeClick = (id: string) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (pending) {
      if (pending.kind === "choice") {
        patchChoice(pending.sourceId, pending.choiceId, { nextNodeId: id });
      } else if (pending.sourceId !== id) {
        linkChoice(pending.sourceId, id);
      }
      setPending(null);
      setSelectedId(id);
      return;
    }
    setSelectedId(id);
  };

  /* ---- keyboard ----------------------------------------------------------- */

  const nudge = (node: BNode, dx: number, dy: number) => {
    const pos = resolvePos(node);
    patchNode(node.id, {
      position: {
        x: clamp01(roundCoord(pos.x + dx)),
        y: clamp01(roundCoord(pos.y + dy)),
      },
    });
  };

  const onNodeKeyDown = (node: BNode) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        nudge(node, -NUDGE, 0);
        break;
      case "ArrowRight":
        e.preventDefault();
        nudge(node, NUDGE, 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        nudge(node, 0, -NUDGE);
        break;
      case "ArrowDown":
        e.preventDefault();
        nudge(node, 0, NUDGE);
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        deleteNode(node.id);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        setSelectedId(node.id);
        focusRail();
        break;
      case "Escape":
        e.preventDefault();
        setSelectedId(null);
        setPending(null);
        break;
      default:
        break;
    }
  };

  /* ---- derived render data ------------------------------------------------ */

  const nodeLabel = (n: BNode): string => truncate(htmlToText(n.prompt) || "Untitled step");

  const edges = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    const list: Array<{ id: string; from: BNode; to: BNode; choice: Choice }> = [];
    for (const n of nodes) {
      if (n.choices == null) continue;
      for (const c of n.choices) {
        const to = byId.get(c.nextNodeId);
        if (to) list.push({ id: `${n.id}:${c.id}`, from: n, to, choice: c });
      }
    }
    return list;
  }, [nodes]);

  const nodeKind = (n: BNode): { label: string; glyph: string; cls: string } => {
    if (n.id === startNodeId) return { label: "Start", glyph: "▶", cls: "is-start" };
    if (isTerminal(n)) return { label: "End", glyph: "■", cls: "is-terminal" };
    return { label: "Decision", glyph: "◆", cls: "is-decision" };
  };

  /* ---- render ------------------------------------------------------------- */

  return (
    <div className="ks-bs-ed">
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

      {notice && (
        <p className="ks-bs-ed__notice" role="status">
          {notice}
        </p>
      )}

      {nodes.length === 0 ? (
        <div className="ks-bs-ed__start">
          <h3 className="ks-bs-ed__start-title">Map out a branching decision</h3>
          <p className="ks-bs-ed__start-body">
            Each step shows a prompt, then either a set of choices that lead onward or a final
            outcome screen. Add a node to start.
          </p>
          <button
            type="button"
            className="kukui-studio-btn kukui-studio-btn--primary"
            onClick={addFirstNode}
          >
            Add first node
          </button>
        </div>
      ) : (
        <>
          <div className="ks-bs-ed__main">
            <div className="ks-bs-ed__toolbar">
              <span className="ks-bs-ed__count">
                {nodes.length} step{nodes.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="kukui-studio-btn kukui-studio-btn--primary kukui-studio-btn--sm"
                onClick={addNode}
              >
                + Add node
              </button>
              {pending && (
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                  onClick={() => setPending(null)}
                >
                  Cancel link
                </button>
              )}
            </div>

            {pending && (
              <p className="ks-bs-ed__hint" role="status">
                Click a step to link it as this choice's target.
              </p>
            )}

            <div
              ref={boardRef}
              className={["ks-bs-ed__board", pending ? "is-linking" : ""]
                .filter(Boolean)
                .join(" ")}
              onPointerMove={onBoardMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onClick={(e) => {
                if (e.target === boardRef.current) {
                  setSelectedId(null);
                  setPending(null);
                }
              }}
            >
              <svg className="ks-bs-ed__edges" aria-hidden="true">
                <defs>
                  <marker
                    id="ks-bs-arrow"
                    markerWidth="9"
                    markerHeight="9"
                    refX="7.5"
                    refY="4.5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M0,0 L9,4.5 L0,9 Z" fill="currentColor" />
                  </marker>
                </defs>
                {edges.map((e) => {
                  const a = resolvePos(e.from);
                  const b = resolvePos(e.to);
                  const dx = b.x - a.x;
                  const dy = b.y - a.y;
                  const len = Math.hypot(dx, dy) || 1;
                  // Pull the arrow tip back off the target card center.
                  const ex = b.x - (dx / len) * 0.06;
                  const ey = b.y - (dy / len) * 0.06;
                  return (
                    <line
                      key={e.id}
                      className="ks-bs-ed__edge"
                      x1={`${a.x * 100}%`}
                      y1={`${a.y * 100}%`}
                      x2={`${ex * 100}%`}
                      y2={`${ey * 100}%`}
                      markerEnd="url(#ks-bs-arrow)"
                    />
                  );
                })}
              </svg>

              {nodes.map((n) => {
                const pos =
                  drag.mode === "move" && drag.id === n.id ? { x: drag.x, y: drag.y } : resolvePos(n);
                const kind = nodeKind(n);
                const isSel = n.id === selectedId;
                const style: CSSProperties = {
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                };
                return (
                  <div
                    key={n.id}
                    className={[
                      "ks-bs-ed__node",
                      kind.cls,
                      isSel ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={style}
                    role="button"
                    tabIndex={0}
                    aria-label={`${kind.label} step: ${nodeLabel(n)}`}
                    aria-pressed={isSel}
                    onPointerDown={startNodeDrag(n)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNodeClick(n.id);
                    }}
                    onKeyDown={onNodeKeyDown(n)}
                  >
                    <span className={["ks-bs-ed__badge", kind.cls].join(" ")}>
                      <span className="ks-bs-ed__badge-glyph" aria-hidden="true">
                        {kind.glyph}
                      </span>
                      {kind.label}
                    </span>
                    <span className="ks-bs-ed__node-label">{nodeLabel(n)}</span>
                    <button
                      type="button"
                      className="ks-bs-ed__connect"
                      onClick={(e) => {
                        e.stopPropagation();
                        draggedRef.current = false;
                        setSelectedId(n.id);
                        setPending({ kind: "node", sourceId: n.id });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label={`Link a new choice from ${nodeLabel(n)} to another step`}
                    >
                      + link →
                    </button>
                  </div>
                );
              })}
            </div>

            {edges.length > 0 && (
              <ul className="ks-bs-ed__edge-list" aria-label="Choice links">
                {edges.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="ks-bs-ed__edge-handle"
                      aria-label={`Link from ${nodeLabel(e.from)} to ${nodeLabel(
                        e.to,
                      )}. Press Delete to remove this choice.`}
                      onClick={() => {
                        setSelectedId(e.from.id);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Delete" || ev.key === "Backspace") {
                          ev.preventDefault();
                          removeChoice(e.from.id, e.choice.id);
                        }
                      }}
                    >
                      {nodeLabel(e.from)} <span aria-hidden="true">→</span> {nodeLabel(e.to)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="ks-bs-ed__rail" ref={railRef} aria-label="Step settings">
            {selected ? (
              <NodeInspector
                key={selected.id}
                node={selected}
                nodes={nodes}
                isStart={selected.id === startNodeId}
                scoreMode={scoreMode}
                urlMap={urlMap}
                onPatchNode={(fields) => patchNode(selected.id, fields)}
                onSetStart={() => setStart(selected.id)}
                onSetTerminal={(t) => setTerminal(selected.id, t)}
                onAddChoice={() => addChoice(selected.id)}
                onPatchChoice={(cid, fields) => patchChoice(selected.id, cid, fields)}
                onRemoveChoice={(cid) => removeChoice(selected.id, cid)}
                onConnectChoice={(cid) =>
                  setPending({ kind: "choice", sourceId: selected.id, choiceId: cid })
                }
                onPatchOutcome={(fields) => patchOutcome(selected.id, fields)}
                onDelete={() => deleteNode(selected.id)}
              />
            ) : (
              <div className="ks-bs-ed__panel">
                <h3 className="ks-bs-ed__panel-title">Scenario</h3>
                <label className="ks-bs-ed__field">
                  Scoring mode
                  <select
                    value={scoreMode}
                    onChange={(e) => setScoreMode(e.target.value as ScoreMode)}
                  >
                    <option value="terminal">Terminal (score is the ending's value)</option>
                    <option value="path">Path points (sum choices along the route)</option>
                  </select>
                </label>
                <p className="ks-bs-ed__help">
                  {scoreMode === "path"
                    ? "Each choice contributes its points; the score is the total earned along the learner's route."
                    : "The score is the reached ending's own value. Choice points are ignored."}
                </p>
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--primary kukui-studio-btn--sm"
                  onClick={addNode}
                >
                  + Add node
                </button>
                <p className="ks-bs-ed__noselect">Select a step on the canvas to edit it.</p>
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}

function NodeInspector({
  node,
  nodes,
  isStart,
  scoreMode,
  urlMap,
  onPatchNode,
  onSetStart,
  onSetTerminal,
  onAddChoice,
  onPatchChoice,
  onRemoveChoice,
  onConnectChoice,
  onPatchOutcome,
  onDelete,
}: {
  node: BNode;
  nodes: BNode[];
  isStart: boolean;
  scoreMode: ScoreMode;
  urlMap: Record<string, string>;
  onPatchNode: (fields: Partial<BNode>) => void;
  onSetStart: () => void;
  onSetTerminal: (terminal: boolean) => void;
  onAddChoice: () => void;
  onPatchChoice: (choiceId: string, fields: Partial<Choice>) => void;
  onRemoveChoice: (choiceId: string) => void;
  onConnectChoice: (choiceId: string) => void;
  onPatchOutcome: (fields: Partial<Outcome>) => void;
  onDelete: () => void;
}) {
  const nodeFileRef = useRef<HTMLInputElement>(null);
  const outcomeFileRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const terminal = isTerminal(node);

  const pickImage = async (file: File, apply: (img: NodeImage) => void) => {
    const id = newAssetId();
    await putSlideAsset(id, file);
    const { w, h } = await readImageMeta(file);
    apply({
      assetId: id,
      alt: file.name.replace(/\.[^.]+$/, "") || "Image",
      naturalWidth: w,
      naturalHeight: h,
    });
  };

  const nodeImgUrl = node.image
    ? (node.image.assetId ? urlMap[node.image.assetId] : undefined) ?? node.image.src
    : undefined;
  const outcomeImg = node.outcome?.image;
  const outcomeImgUrl = outcomeImg
    ? (outcomeImg.assetId ? urlMap[outcomeImg.assetId] : undefined) ?? outcomeImg.src
    : undefined;

  return (
    <div className="ks-bs-ed__inspector">
      <div className="ks-bs-ed__inspector-head">
        <h3>{terminal ? "Ending step" : "Decision step"}</h3>
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
          onClick={() => setConfirmDelete(true)}
        >
          Delete step
        </button>
      </div>

      {confirmDelete && (
        <div className="ks-bs-ed__confirm" role="group" aria-label="Confirm delete step">
          <p className="ks-bs-ed__confirm-msg">
            Delete this step? Choices pointing to it will be cleared.
          </p>
          <div className="ks-bs-ed__confirm-actions">
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--danger kukui-studio-btn--sm"
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <label className="ks-bs-ed__field">
        Prompt
        <textarea
          rows={3}
          value={htmlToText(node.prompt)}
          onChange={(e) => onPatchNode({ prompt: toHtml(e.target.value) })}
        />
      </label>

      {/* Node image */}
      <div className="ks-bs-ed__field">
        <span className="ks-bs-ed__field-label">Image (optional)</span>
        {node.image ? (
          <div className="ks-bs-ed__image">
            {nodeImgUrl ? (
              <img className="ks-bs-ed__image-thumb" src={nodeImgUrl} alt={node.image.alt} />
            ) : (
              <span className="ks-bs-ed__image-missing">Image attached</span>
            )}
            <label className="ks-bs-ed__field ks-bs-ed__field--tight">
              Alt text (required)
              <input
                type="text"
                value={node.image.alt}
                onChange={(e) =>
                  onPatchNode({ image: { ...(node.image as NodeImage), alt: e.target.value } })
                }
              />
            </label>
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
              onClick={() => onPatchNode({ image: undefined })}
            >
              Remove image
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="kukui-studio-btn kukui-studio-btn--secondary kukui-studio-btn--sm"
            onClick={() => nodeFileRef.current?.click()}
          >
            Attach image
          </button>
        )}
        <input
          ref={nodeFileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void pickImage(f, (img) => onPatchNode({ image: img }));
          }}
        />
      </div>

      {/* Start + terminal controls */}
      <div className="ks-bs-ed__row">
        <button
          type="button"
          className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
          onClick={onSetStart}
          disabled={isStart}
        >
          {isStart ? "✓ Start step" : "Make start step"}
        </button>
        <label className="ks-bs-ed__check">
          <input
            type="checkbox"
            checked={terminal}
            onChange={(e) => onSetTerminal(e.target.checked)}
          />
          Ending (shows an outcome, no choices)
        </label>
      </div>

      {terminal ? (
        <fieldset className="ks-bs-ed__outcome">
          <legend>End screen</legend>
          <label className="ks-bs-ed__field">
            Outcome title (optional)
            <input
              type="text"
              value={node.outcome?.title ?? ""}
              onChange={(e) => onPatchOutcome({ title: e.target.value || undefined })}
            />
          </label>
          <label className="ks-bs-ed__field">
            Message (optional)
            <textarea
              rows={2}
              value={node.outcome?.message ? htmlToText(node.outcome.message) : ""}
              onChange={(e) =>
                onPatchOutcome({ message: e.target.value ? toHtml(e.target.value) : undefined })
              }
            />
          </label>
          <div className="ks-bs-ed__row">
            <label className="ks-bs-ed__field ks-bs-ed__field--inline">
              Score (0–1)
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={node.outcome?.score ?? 0}
                onChange={(e) =>
                  onPatchOutcome({
                    score: clamp01(Number.parseFloat(e.target.value) || 0),
                  })
                }
              />
            </label>
            <label className="ks-bs-ed__check">
              <input
                type="checkbox"
                checked={node.outcome?.success ?? false}
                onChange={(e) => onPatchOutcome({ success: e.target.checked })}
              />
              Counts as success
            </label>
          </div>
          <div className="ks-bs-ed__field">
            <span className="ks-bs-ed__field-label">End-screen image (optional)</span>
            {outcomeImg ? (
              <div className="ks-bs-ed__image">
                {outcomeImgUrl ? (
                  <img className="ks-bs-ed__image-thumb" src={outcomeImgUrl} alt={outcomeImg.alt} />
                ) : (
                  <span className="ks-bs-ed__image-missing">Image attached</span>
                )}
                <label className="ks-bs-ed__field ks-bs-ed__field--tight">
                  Alt text (required)
                  <input
                    type="text"
                    value={outcomeImg.alt}
                    onChange={(e) =>
                      onPatchOutcome({ image: { ...outcomeImg, alt: e.target.value } })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                  onClick={() => onPatchOutcome({ image: undefined })}
                >
                  Remove image
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="kukui-studio-btn kukui-studio-btn--secondary kukui-studio-btn--sm"
                onClick={() => outcomeFileRef.current?.click()}
              >
                Attach image
              </button>
            )}
            <input
              ref={outcomeFileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void pickImage(f, (img) => onPatchOutcome({ image: img }));
              }}
            />
          </div>
        </fieldset>
      ) : (
        <div className="ks-bs-ed__choices">
          <span className="ks-bs-ed__choices-label">Choices</span>
          {(node.choices ?? []).map((c, i) => (
            <div key={c.id} className="ks-bs-ed__choice">
              <label className="ks-bs-ed__field ks-bs-ed__field--tight">
                Choice {i + 1} text
                <input
                  type="text"
                  value={htmlToText(c.text)}
                  onChange={(e) => onPatchChoice(c.id, { text: toHtml(e.target.value) })}
                />
              </label>
              <div className="ks-bs-ed__row">
                <label className="ks-bs-ed__field ks-bs-ed__field--inline">
                  Goes to
                  <select
                    value={c.nextNodeId}
                    onChange={(e) => onPatchChoice(c.id, { nextNodeId: e.target.value })}
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {truncate(htmlToText(n.prompt) || n.id, 30)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                  onClick={() => onConnectChoice(c.id)}
                >
                  Set target on canvas
                </button>
              </div>
              {scoreMode === "path" && (
                <label className="ks-bs-ed__field ks-bs-ed__field--inline">
                  Points
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={c.points ?? 0}
                    onChange={(e) =>
                      onPatchChoice(c.id, {
                        points: Math.max(0, Number.parseFloat(e.target.value) || 0),
                      })
                    }
                  />
                </label>
              )}
              <label className="ks-bs-ed__field ks-bs-ed__field--tight">
                Feedback (optional)
                <textarea
                  rows={2}
                  value={c.feedback ? htmlToText(c.feedback) : ""}
                  onChange={(e) =>
                    onPatchChoice(c.id, {
                      feedback: e.target.value ? toHtml(e.target.value) : undefined,
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
                onClick={() => onRemoveChoice(c.id)}
              >
                Remove choice
              </button>
            </div>
          ))}
          <button
            type="button"
            className="kukui-studio-btn kukui-studio-btn--secondary kukui-studio-btn--sm"
            onClick={onAddChoice}
          >
            + Add choice
          </button>
        </div>
      )}
    </div>
  );
}
