import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { BranchingScenarioConfig } from "@kukui/schemas/branching-scenario";
import type { ActivityProps } from "../../types.js";
import { SafeHtml, htmlToText } from "../../safe-html.js";
import "./BranchingScenario.css";

type State = {
  currentNodeId: string;
  /** History of node ids visited (excluding currentNodeId), oldest first. */
  path: string[];
  /** True once a terminal node was reached and onSubmit was fired. */
  terminalReached: boolean;
  /** Id of the last choice clicked, used to render its inline feedback. */
  lastChoiceId: string | null;
};

type DefaultOutcome = { score: number; success: boolean; message?: string };

const COMPLETION_DEFAULT: DefaultOutcome = { score: 1, success: true };

export function BranchingScenario({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<BranchingScenarioConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();

  const initialState = useMemo<State>(
    () => ({
      currentNodeId: config.startNodeId,
      path: [],
      terminalReached: false,
      lastChoiceId: null,
    }),
    [config.startNodeId],
  );

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, config) ?? initialState,
  );

  // Index for O(1) lookup of nodes by id.
  const nodesById = useMemo(() => {
    const m = new Map<string, BranchingScenarioConfig["nodes"][number]>();
    for (const n of config.nodes) m.set(n.id, n);
    return m;
  }, [config.nodes]);

  const currentNode = nodesById.get(state.currentNodeId);

  // Persist on every state change (covers each navigation step).
  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

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
    const next: State = { ...state, terminalReached: true };
    setState(next);
    onSubmit({
      raw: outcome.score,
      max: 1,
      success: outcome.success,
      suspendData: JSON.stringify({ ...next, path: [...state.path] }),
    });
    // We intentionally depend only on currentNode + reached flag — onSubmit /
    // state.path are referentially stable enough for our use here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNode, state.terminalReached]);

  if (!currentNode) {
    // Defensive: bad suspendData or a broken nextNodeId got past validation.
    return (
      <div className="kukui-bs">
        <article className="kukui-bs__card" role="alert">
          <p className="kukui-bs__error">
            This scenario can&apos;t continue: node &quot;{state.currentNodeId}
            &quot; is missing from the configuration.
          </p>
        </article>
      </div>
    );
  }

  const isTerminal =
    currentNode.choices === null || currentNode.choices.length === 0;
  const ui = config.ui ?? {};
  const restartLabel = ui.restartButton ?? "Restart";

  const pickChoice = (choiceId: string) => {
    if (state.terminalReached) return;
    const choice = currentNode.choices?.find((c) => c.id === choiceId);
    if (!choice) return;
    const nextNode = nodesById.get(choice.nextNodeId);
    if (!nextNode) {
      // Broken nextNodeId: stay put, surface the error inline.
      setState((s) => ({ ...s, lastChoiceId: choiceId }));
      return;
    }
    setState((s) => ({
      currentNodeId: choice.nextNodeId,
      path: [...s.path, s.currentNodeId],
      terminalReached: false,
      lastChoiceId: choiceId,
    }));
  };

  const restart = () => {
    submittedFor.current = null;
    setState(initialState);
  };

  const lastChoice =
    state.lastChoiceId && currentNode.choices
      ? currentNode.choices.find((c) => c.id === state.lastChoiceId) ?? null
      : null;
  const lastChoiceFeedback = lastChoice?.feedback ?? "";
  const brokenNext =
    state.lastChoiceId && currentNode.choices
      ? (() => {
          const c = currentNode.choices.find(
            (ch) => ch.id === state.lastChoiceId,
          );
          return c && !nodesById.has(c.nextNodeId);
        })()
      : false;

  const outcome = currentNode.outcome ?? (isTerminal ? COMPLETION_DEFAULT : null);

  return (
    <div className="kukui-bs">
      <article className="kukui-bs__card" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-bs__title">
          {config.title}
        </HeadingTag>

        <SafeHtml className="kukui-bs__prompt" html={currentNode.prompt} />

        {!isTerminal && currentNode.choices ? (
          <ul
            role="group"
            aria-label="Choices"
            className="kukui-bs__choices"
          >
            {currentNode.choices.map((c) => {
              const justClicked = state.lastChoiceId === c.id;
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
            lastChoiceFeedback || brokenNext ? "is-visible" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-live="polite"
        >
          {brokenNext
            ? `This choice points to an unknown node — please notify the author.`
            : lastChoiceFeedback}
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
            {config.behaviour?.enableRetry ? (
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
      return {
        currentNodeId: parsed.currentNodeId,
        path: parsed.path.filter((p): p is string => typeof p === "string"),
        terminalReached: parsed.terminalReached === true,
        lastChoiceId:
          typeof parsed.lastChoiceId === "string" ? parsed.lastChoiceId : null,
      };
    }
  } catch {
    /* noop */
  }
  void config;
  return null;
}
