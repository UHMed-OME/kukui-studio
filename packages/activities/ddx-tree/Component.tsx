import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DDxTreeConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { ActivityHeader, SafeHtml, htmlToText, StatusBadge, DotIcon, CheckIcon } from "@kukui/core";
import { resolveScoring } from "@kukui/core/scoring";
import "./Component.css";

type State = {
  currentNodeId: string;
  /**
   * HTML fragments accumulated from each picked choice's `addsToCase`. Rendered
   * as a list under the persistent case header — separate from the path so the
   * panel can grow without re-walking the tree.
   */
  accumulatedCase: string[];
  /** True once a terminal node was reached and onSubmit was fired. */
  terminalReached: boolean;
  /**
   * Feedback text captured from the choice picked to reach the current node.
   * Stored at pick time — the choice itself lives on the *previous* node, so
   * looking it up after navigation would always miss.
   */
  lastFeedback: string | null;
  /**
   * Id of the last clicked choice *on the current node*. Only set when the
   * click didn't navigate (broken nextNodeId), so the highlight and the
   * broken-link message can point at the offending choice.
   */
  lastChoiceId: string | null;
};

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<DDxTreeConfig>) {
  const headingId = useId();
  const caseHeaderId = useId();
  // Section headings sit one level below the activity title so the outline
  // stays correct when the activity is embedded (e.g. course-presentation).
  const H2 = `h${Math.min(headingLevel + 1, 6)}` as "h2" | "h3" | "h4" | "h5" | "h6";

  const initialState = useMemo<State>(
    () => ({
      currentNodeId: config.startNodeId,
      accumulatedCase: [],
      terminalReached: false,
      lastFeedback: null,
      lastChoiceId: null,
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

  const nodesById = useMemo(() => {
    const m = new Map<string, DDxTreeConfig["nodes"][number]>();
    for (const n of config.nodes) m.set(n.id, n);
    return m;
  }, [config.nodes]);

  const currentNode = nodesById.get(state.currentNodeId);

  // Single source of truth for retry / mode (Scoring tab writes
  // config.scoring; resolveScoring also honors the legacy behaviour flag).
  const resolved = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  // Idempotent terminal handling: fire onSubmit exactly once per terminal
  // visit. Guard via terminalReached + a ref tied to the terminal node id so
  // re-renders / re-mounts don't double-fire.
  const submittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!currentNode) return;
    const isTerminal =
      currentNode.choices === null || currentNode.choices.length === 0;
    if (!isTerminal) return;
    const dx = currentNode.diagnosis;
    if (!dx) return;
    if (state.terminalReached) return;
    if (submittedFor.current === currentNode.id) return;
    submittedFor.current = currentNode.id;
    const next: State = { ...state, terminalReached: true };
    setState(next);
    onSubmit({
      raw: dx.score,
      max: 1,
      // Completion mode: reaching any terminal diagnosis completes the
      // activity — success regardless of whether it was the correct one.
      success: resolved.mode === "completion" ? true : dx.correct,
      suspendData: JSON.stringify(next),
    });
    // We intentionally depend only on currentNode + reached flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNode, state.terminalReached]);

  if (!currentNode) {
    return (
      <div className="kukui-ddx">
        <article className="kukui-ddx__card" role="alert">
          <p className="kukui-ddx__error">
            This case can&apos;t continue: node &quot;{state.currentNodeId}&quot;
            is missing from the configuration.
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
      // Broken nextNodeId: stay put, surface error inline.
      setState((s) => ({ ...s, lastChoiceId: choiceId, lastFeedback: null }));
      return;
    }
    setState((s) => ({
      currentNodeId: choice.nextNodeId,
      accumulatedCase: choice.addsToCase
        ? [...s.accumulatedCase, choice.addsToCase]
        : s.accumulatedCase,
      terminalReached: false,
      // Capture the feedback text now — after navigation the picked choice
      // belongs to the previous node and can't be looked up anymore.
      lastFeedback: choice.feedback ?? null,
      // The highlight only makes sense while we're still on the same node.
      lastChoiceId: null,
    }));
  };

  const restart = () => {
    submittedFor.current = null;
    setState(initialState);
  };

  // Feedback was captured at pick time (the picked choice lives on the
  // previous node). lastChoiceId is only set when a broken nextNodeId kept us
  // on the same node, so this lookup is against the right choice list.
  const lastChoiceFeedback = state.lastFeedback ?? "";
  const brokenNext =
    state.lastChoiceId && currentNode.choices
      ? (() => {
          const c = currentNode.choices.find(
            (ch) => ch.id === state.lastChoiceId,
          );
          return c && !nodesById.has(c.nextNodeId);
        })()
      : false;

  const dx = isTerminal ? currentNode.diagnosis : null;

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
    <div className="kukui-ddx">
      <article className="kukui-ddx__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          badge={headerBadge}
        />

        <section
          className="kukui-ddx__case-header"
          aria-labelledby={caseHeaderId}
        >
          <H2 id={caseHeaderId} className="kukui-ddx__case-header-title">
            Case
          </H2>
          <SafeHtml className="kukui-ddx__case-header-body" html={config.caseHeader} />
        </section>

        {/*
         * "Case so far" panel — grows as the learner picks choices that add
         * to the case. Always present (with a placeholder) so the layout is
         * stable from first render.
         */}
        <section
          className="kukui-ddx__case-so-far"
          aria-label="Case so far"
        >
          <H2 className="kukui-ddx__case-so-far-title">Case so far</H2>
          {state.accumulatedCase.length === 0 ? (
            <p className="kukui-ddx__case-so-far-empty">
              No additional findings yet — make a choice below.
            </p>
          ) : (
            <ul className="kukui-ddx__case-so-far-list">
              {state.accumulatedCase.map((html, i) => (
                <li key={i} className="kukui-ddx__case-so-far-item">
                  <SafeHtml as="span" html={html} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <SafeHtml
          className="kukui-ddx__presentation"
          html={currentNode.presentation}
        />

        {!isTerminal && currentNode.choices ? (
          <ul role="group" aria-label="Choices" className="kukui-ddx__choices">
            {currentNode.choices.map((c) => {
              const justClicked = state.lastChoiceId === c.id;
              return (
                <li key={c.id} className="kukui-ddx__choice-row">
                  <button
                    type="button"
                    className={[
                      "kukui-ddx__choice",
                      justClicked ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={htmlToText(c.text)}
                    onClick={() => pickChoice(c.id)}
                  >
                    <SafeHtml
                      as="span"
                      className="kukui-ddx__choice-text"
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
            "kukui-ddx__feedback",
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

        {isTerminal && dx ? (
          <section
            className={[
              "kukui-ddx__diagnosis",
              dx.correct ? "is-correct" : "is-incorrect",
            ].join(" ")}
            aria-live="polite"
          >
            <header className="kukui-ddx__diagnosis-header">
              <span
                className="kukui-ddx__diagnosis-icon"
                aria-hidden="true"
              >
                {dx.correct ? "✓" : "✗"}
              </span>
              <p className="kukui-ddx__diagnosis-name">
                <span className="kukui-ddx__diagnosis-label">
                  {dx.correct ? "Correct" : "Incorrect"}:
                </span>{" "}
                {dx.name}
              </p>
            </header>
            {dx.explanation ? (
              <SafeHtml
                className="kukui-ddx__diagnosis-explanation"
                html={dx.explanation}
              />
            ) : null}
            {resolved.enableRetry ? (
              <button
                type="button"
                className="kukui-ddx__secondary"
                onClick={restart}
              >
                {restartLabel}
              </button>
            ) : null}
          </section>
        ) : null}

        {/* Mid-case restart: once the learner has left the start node they
            can start over without finishing, when the author allows retry. */}
        {!isTerminal &&
        resolved.enableRetry &&
        state.currentNodeId !== config.startNodeId ? (
          <nav className="kukui-ddx__nav" aria-label="Case controls">
            <button
              type="button"
              className="kukui-ddx__secondary"
              onClick={restart}
            >
              {restartLabel}
            </button>
          </nav>
        ) : null}
      </article>
    </div>
  );
}

function parseSuspend(
  s: string | undefined,
  config: DDxTreeConfig,
): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (
      parsed &&
      typeof parsed.currentNodeId === "string" &&
      Array.isArray(parsed.accumulatedCase)
    ) {
      // A stale draft (node deleted/renamed in Studio) must not strand the
      // learner on an unrecoverable "can't continue" card — fall back to the
      // initial state instead of trusting the saved node id.
      if (!config.nodes.some((n) => n.id === parsed.currentNodeId)) return null;
      return {
        currentNodeId: parsed.currentNodeId,
        accumulatedCase: parsed.accumulatedCase.filter(
          (p): p is string => typeof p === "string",
        ),
        terminalReached: parsed.terminalReached === true,
        lastFeedback:
          typeof parsed.lastFeedback === "string" ? parsed.lastFeedback : null,
        lastChoiceId:
          typeof parsed.lastChoiceId === "string" ? parsed.lastChoiceId : null,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
