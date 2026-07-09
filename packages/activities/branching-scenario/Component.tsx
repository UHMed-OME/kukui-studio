import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { BranchingScenarioConfig } from "./schema.js";
import { resolveScoring } from "@kukui/core/scoring";
import { ActivityHeader, SafeHtml, htmlToText, StatusBadge, DotIcon, CheckIcon, type ActivityProps } from "@kukui/core";
import "./Component.css";

type LastPick = {
  /** Id of the node the learner was on when they picked (not the destination). */
  nodeId: string;
  choiceId: string;
  /**
   * Feedback captured at pick time. The picked choice unmounts on navigation,
   * so looking it up in the *current* node's choices later would miss it (or,
   * worse, match an unrelated choice that reuses the same id).
   */
  feedback: string | null;
  /** True when the choice pointed at a missing node and navigation was refused. */
  brokenNext: boolean;
};

type State = {
  currentNodeId: string;
  /** History of node ids visited (excluding currentNodeId), oldest first. */
  path: string[];
  /** True once a terminal node was reached and onSubmit was fired. */
  terminalReached: boolean;
  /** The last choice picked, captured at pick time (see LastPick). */
  lastPick: LastPick | null;
};

type DefaultOutcome = { score: number; success: boolean; message?: string };

const COMPLETION_DEFAULT: DefaultOutcome = { score: 1, success: true };

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<BranchingScenarioConfig>) {
  const headingId = useId();

  const initialState = useMemo<State>(
    () => ({
      currentNodeId: config.startNodeId,
      path: [],
      terminalReached: false,
      lastPick: null,
    }),
    [config.startNodeId],
  );

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, config) ?? initialState,
  );

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(parseSuspend(suspendData, config) ?? initialState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Index for O(1) lookup of nodes by id.
  const nodesById = useMemo(() => {
    const m = new Map<string, BranchingScenarioConfig["nodes"][number]>();
    for (const n of config.nodes) m.set(n.id, n);
    return m;
  }, [config.nodes]);

  const currentNode = nodesById.get(state.currentNodeId);

  const scoring = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);

  // Persist on every state change (covers each navigation step).
  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  // Focus management: after navigating, the clicked choice button unmounts and
  // focus would drop to <body>, leaving keyboard and screen-reader users
  // stranded with no announcement of the new prompt. Move focus to the new
  // node's prompt region instead (tabIndex={-1} target). Skipped on initial
  // mount so embedding pages don't get their focus stolen on load.
  const promptRef = useRef<HTMLDivElement | null>(null);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    promptRef.current?.focus();
  }, [state.currentNodeId]);

  // Idempotent terminal handling: fire onSubmit exactly once when terminal
  // is first seen for a given path. We guard with terminalReached + a ref
  // so re-renders / re-mounts don't double-fire.
  const submittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!currentNode) return;
    const isTerminal =
      currentNode.choices === null || currentNode.choices.length === 0;
    if (!isTerminal) return;
    if (state.terminalReached) return;
    if (submittedFor.current === currentNode.id) return;
    submittedFor.current = currentNode.id;
    const outcome = currentNode.outcome ?? COMPLETION_DEFAULT;
    // Under completion scoring, reaching any ending completes the activity
    // successfully — per-node outcome scores only apply in points modes.
    const isCompletion = scoring.mode === "completion";
    const next: State = { ...state, terminalReached: true };
    setState(next);
    onSubmit({
      raw: isCompletion ? 1 : outcome.score,
      max: 1,
      success: isCompletion ? true : outcome.success,
      suspendData: JSON.stringify({ ...next, path: [...state.path] }),
    });
    // We intentionally depend only on currentNode + reached flag — onSubmit /
    // state.path are referentially stable enough for our use here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNode, state.terminalReached, scoring.mode]);

  const ui = config.ui ?? {};
  const restartLabel = ui.restartButton ?? "Restart";

  const restart = () => {
    submittedFor.current = null;
    setState(initialState);
  };

  if (!currentNode) {
    // Defensive: a runtime-impossible state got past validation (e.g. a
    // broken startNodeId). Keep the screen, but make it recoverable.
    return (
      <div className="kukui-bs">
        <article className="kukui-bs__card" role="alert">
          <p className="kukui-bs__error">
            This scenario can&apos;t continue: node &quot;{state.currentNodeId}
            &quot; is missing from the configuration.
          </p>
          <button
            type="button"
            className="kukui-bs__secondary"
            onClick={restart}
          >
            {restartLabel}
          </button>
        </article>
      </div>
    );
  }

  const isTerminal =
    currentNode.choices === null || currentNode.choices.length === 0;

  const pickChoice = (choiceId: string) => {
    if (state.terminalReached) return;
    const choice = currentNode.choices?.find((c) => c.id === choiceId);
    if (!choice) return;
    const nextNode = nodesById.get(choice.nextNodeId);
    if (!nextNode) {
      // Broken nextNodeId: stay put, surface the error inline.
      setState((s) => ({
        ...s,
        lastPick: {
          nodeId: s.currentNodeId,
          choiceId,
          feedback: choice.feedback ?? null,
          brokenNext: true,
        },
      }));
      return;
    }
    setState((s) => ({
      currentNodeId: choice.nextNodeId,
      path: [...s.path, s.currentNodeId],
      terminalReached: false,
      lastPick: {
        nodeId: s.currentNodeId,
        choiceId,
        feedback: choice.feedback ?? null,
        brokenNext: false,
      },
    }));
  };

  const lastPick = state.lastPick;
  const lastPickFeedback = lastPick && !lastPick.brokenNext ? lastPick.feedback ?? "" : "";
  const brokenNext = lastPick?.brokenNext === true;

  const outcome = currentNode.outcome ?? (isTerminal ? COMPLETION_DEFAULT : null);

  const headerBadge = state.terminalReached ? (
    <StatusBadge tone="success" icon={<CheckIcon />}>
      Complete
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral" icon={<DotIcon />}>
      In progress
    </StatusBadge>
  );

  return (
    <div className="kukui-bs">
      <article className="kukui-bs__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          badge={headerBadge}
        />

        <div className="kukui-bs__prompt" ref={promptRef} tabIndex={-1}>
          <SafeHtml html={currentNode.prompt} />
        </div>

        {!isTerminal && currentNode.choices ? (
          <ul
            role="group"
            aria-label="Choices"
            className="kukui-bs__choices"
          >
            {currentNode.choices.map((c) => {
              // is-active only when the pick happened *on this node* — choice
              // ids may be reused across nodes, so the id alone is ambiguous.
              const justClicked =
                lastPick !== null &&
                lastPick.nodeId === currentNode.id &&
                lastPick.choiceId === c.id;
              return (
                <li key={c.id} className="kukui-bs__choice-row">
                  <button
                    type="button"
                    className={[
                      "kukui-bs__choice",
                      justClicked ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={htmlToText(c.text)}
                    onClick={() => pickChoice(c.id)}
                  >
                    <SafeHtml
                      as="span"
                      className="kukui-bs__choice-text"
                      html={c.text}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {/* Pattern A inline feedback row: constant min-height, opacity-only fade. */}
        <div
          className={[
            "kukui-bs__feedback",
            lastPickFeedback || brokenNext ? "is-visible" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-live="polite"
        >
          {brokenNext
            ? `This choice points to an unknown node — please notify the author.`
            : lastPickFeedback}
        </div>

        {isTerminal && outcome ? (
          <section
            className={[
              "kukui-bs__outcome",
              outcome.success ? "is-success" : "is-fail",
            ].join(" ")}
            aria-live="polite"
          >
            {outcome.message ? (
              <SafeHtml
                className="kukui-bs__outcome-message"
                html={outcome.message}
              />
            ) : (
              <p className="kukui-bs__outcome-message">
                {outcome.success
                  ? "Scenario complete."
                  : "Scenario complete — review your path and try again."}
              </p>
            )}
            {scoring.enableRetry ? (
              <button
                type="button"
                className="kukui-bs__secondary"
                onClick={restart}
              >
                {restartLabel}
              </button>
            ) : null}
          </section>
        ) : null}
      </article>
    </div>
  );
}

function parseSuspend(
  s: string | undefined,
  config: BranchingScenarioConfig,
): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (
      parsed &&
      typeof parsed.currentNodeId === "string" &&
      Array.isArray(parsed.path)
    ) {
      // A stale draft (the author renamed/deleted nodes since the learner's
      // last visit) may reference a node that no longer exists. Falling back
      // to initial state beats an unrecoverable missing-node screen.
      if (!config.nodes.some((n) => n.id === parsed.currentNodeId)) return null;
      return {
        currentNodeId: parsed.currentNodeId,
        path: parsed.path.filter((p): p is string => typeof p === "string"),
        terminalReached: parsed.terminalReached === true,
        lastPick: parseLastPick(parsed.lastPick),
      };
    }
  } catch {
    /* noop */
  }
  return null;
}

function parseLastPick(v: unknown): LastPick | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Partial<LastPick>;
  if (typeof p.nodeId !== "string" || typeof p.choiceId !== "string") return null;
  return {
    nodeId: p.nodeId,
    choiceId: p.choiceId,
    feedback: typeof p.feedback === "string" ? p.feedback : null,
    brokenNext: p.brokenNext === true,
  };
}
