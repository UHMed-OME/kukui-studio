import { useEffect, useId, useMemo, useState } from "react";
import type { OSCEConfig } from "./schema.js";
import type { ActivityProps, ScoreState } from "@kukui/core/types";
import {
  ActivityHeader,
  aggregate,
  percentage,
  SafeHtml,
  htmlToText,
  StatusBadge,
  DotIcon,
  CheckIcon,
  TrophyIcon,
} from "@kukui/core";
import { resolveScoring } from "@kukui/core/scoring";
import "./Component.css";

type Stage = "answering" | "submitted";

type State = {
  stage: Stage;
  /** Index of the currently active phase. */
  current: number;
  /** Per-phase set of selected action ids. */
  selectedByPhase: Record<string, string[]>;
  /** Phase ids in the order the learner visited them. */
  visitOrder: string[];
  attempts: number;
};

function buildInitialState(config: OSCEConfig): State {
  const firstId = config.phases[0]?.id ?? "";
  return {
    stage: "answering",
    current: 0,
    selectedByPhase: {},
    visitOrder: firstId ? [firstId] : [],
    attempts: 0,
  };
}

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<OSCEConfig>) {
  const headingId = useId();
  const liveId = useId();

  const initial = useMemo<State>(() => buildInitialState(config), [config]);

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, config) ?? initial,
  );

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(parseSuspend(suspendData, config) ?? initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const total = config.phases.length;
  const phase = config.phases[state.current];
  const isLast = state.current === total - 1;
  const submitted = state.stage === "submitted";
  const allowSkip = config.behaviour?.allowSkipPhase ?? false;

  const ui = config.ui ?? {};
  const nextLabel = ui.nextPhaseButton ?? "Next phase";
  const submitLabel = ui.submitButton ?? "Submit OSCE";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";

  const scoring = useMemo(() => computeScoring(config, state), [config, state]);

  if (!phase) return null;

  const goToPhase = (index: number) => {
    if (submitted) return;
    if (index < 0 || index >= total) return;
    if (!allowSkip && index !== state.current + 1 && index !== state.current - 1) {
      // Linear-only: ignore arbitrary jumps when skipping isn't allowed.
      // (Stepper buttons are also disabled for those targets — this is a
      // safety net.)
      return;
    }
    setState((s) => {
      const targetId = config.phases[index]?.id;
      if (!targetId) return s;
      const visited = s.visitOrder.includes(targetId)
        ? s.visitOrder
        : [...s.visitOrder, targetId];
      return { ...s, current: index, visitOrder: visited };
    });
  };

  const goNext = () => goToPhase(state.current + 1);

  const toggleAction = (phaseId: string, actionId: string) => {
    if (submitted) return;
    setState((s) => {
      const current = s.selectedByPhase[phaseId] ?? [];
      const has = current.includes(actionId);
      const next = has
        ? current.filter((id) => id !== actionId)
        : [...current, actionId];
      return {
        ...s,
        selectedByPhase: { ...s.selectedByPhase, [phaseId]: next },
      };
    });
  };

  const submit = () => {
    if (submitted) return;
    const next: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    setState(next);
    onSubmit({
      raw: scoring.total.raw,
      max: scoring.total.max,
      success: scoring.total.success,
      suspendData: JSON.stringify(next),
    });
  };

  const tryAgain = () => setState(buildInitialState(config));

  const selectedHere = state.selectedByPhase[phase.id] ?? [];
  const phaseScore = scoring.byPhase[phase.id];

  const headerBadge = submitted ? (
    <StatusBadge
      tone={scoring.total.success ? "success" : "warning"}
      icon={scoring.total.success ? <TrophyIcon /> : <CheckIcon />}
    >
      {scoring.total.success ? "Passed" : "Review"}
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral" icon={<DotIcon />}>
      In progress
    </StatusBadge>
  );

  return (
    <div className="kukui-osce">
      <article className="kukui-osce__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          badge={headerBadge}
        />

        <div className="kukui-osce__header">
          <SafeHtml className="kukui-osce__case-header" html={config.caseHeader} />
        </div>

        <nav className="kukui-osce__stepper" aria-label="OSCE phases">
          <ol className="kukui-osce__stepper-list">
            {config.phases.map((p, i) => {
              const isCurrent = i === state.current;
              const visited = state.visitOrder.includes(p.id);
              const linearReachable =
                allowSkip || i === state.current || i === state.current + 1 || visited;
              const disabled = submitted || !linearReachable;
              return (
                <li key={p.id} className="kukui-osce__stepper-item">
                  <button
                    type="button"
                    className={[
                      "kukui-osce__stepper-btn",
                      isCurrent ? "is-current" : "",
                      visited && !isCurrent ? "is-visited" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`Phase ${i + 1} of ${total}: ${p.name}${
                      isCurrent ? ", current" : visited ? ", visited" : ""
                    }`}
                    disabled={disabled}
                    onClick={() => goToPhase(i)}
                  >
                    <span className="kukui-osce__stepper-index" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="kukui-osce__stepper-name">{p.name}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section
          className="kukui-osce__phase"
          aria-labelledby={`${headingId}-phase-${state.current}`}
        >
          <h2
            id={`${headingId}-phase-${state.current}`}
            className="kukui-osce__phase-title"
          >
            {phase.name}
          </h2>
          {phase.description ? (
            <SafeHtml className="kukui-osce__phase-desc" html={phase.description} />
          ) : null}

          <ul
            role="group"
            aria-label={`${phase.name} actions`}
            className="kukui-osce__actions"
          >
            {phase.actions.map((a) => {
              const selected = selectedHere.includes(a.id);
              const isCorrect = submitted && selected && a.correct;
              const isWrong = submitted && selected && !a.correct;
              const stateLabel = isCorrect
                ? "correct"
                : isWrong
                  ? "incorrect"
                  : selected
                    ? "selected"
                    : "not selected";
              return (
                <li key={a.id} className="kukui-osce__action-row">
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${htmlToText(a.text)}, ${stateLabel}`}
                    disabled={submitted}
                    className={[
                      "kukui-osce__action",
                      selected ? "is-selected" : "",
                      isCorrect ? "is-correct" : "",
                      isWrong ? "is-incorrect" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => toggleAction(phase.id, a.id)}
                  >
                    <span className="kukui-osce__action-text">{a.text}</span>
                    <span className="kukui-osce__action-icon" aria-hidden="true">
                      {isCorrect ? "✓" : isWrong ? "✗" : selected ? "●" : ""}
                    </span>
                  </button>
                  <div
                    className={[
                      "kukui-osce__action-feedback",
                      submitted && selected && a.feedback ? "is-visible" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-live="polite"
                  >
                    {submitted && selected && a.feedback ? a.feedback : ""}
                  </div>
                </li>
              );
            })}
          </ul>

          {submitted && phaseScore ? (
            <div
              className="kukui-osce__phase-summary"
              role="status"
              aria-live="polite"
            >
              <span className="kukui-osce__phase-summary-label">
                {phase.name} score:
              </span>{" "}
              <strong>
                {phaseScore.raw} / {phaseScore.max}
              </strong>
            </div>
          ) : null}
        </section>

        <div
          id={liveId}
          className={[
            "kukui-osce__overall-feedback",
            submitted ? "is-visible" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {submitted
            ? `Total: ${scoring.total.raw} of ${scoring.total.max} (${percentage(scoring.total)}%).`
            : ""}
        </div>

        <nav className="kukui-osce__nav" aria-label="Phase navigation">
          {!submitted && !isLast ? (
            <button
              type="button"
              className="kukui-osce__primary"
              onClick={goNext}
            >
              {nextLabel}
            </button>
          ) : null}
          {!submitted && isLast ? (
            <button
              type="button"
              className="kukui-osce__primary"
              onClick={submit}
            >
              {submitLabel}
            </button>
          ) : null}
          {submitted && config.behaviour?.enableRetry ? (
            <button
              type="button"
              className="kukui-osce__secondary"
              onClick={tryAgain}
            >
              {tryAgainLabel}
            </button>
          ) : null}
        </nav>

        {submitted ? (
          <section className="kukui-osce__review" aria-label="Per-phase summary">
            <h2 className="kukui-osce__review-title">Per-phase summary</h2>
            <ul className="kukui-osce__review-list">
              {config.phases.map((p) => {
                const score = scoring.byPhase[p.id];
                if (!score) return null;
                return (
                  <li key={p.id} className="kukui-osce__review-item">
                    <span className="kukui-osce__review-name">{p.name}</span>
                    <span className="kukui-osce__review-score">
                      {score.raw} / {score.max}
                    </span>
                  </li>
                );
              })}
              {config.expectedOrder ? (
                <li className="kukui-osce__review-item">
                  <span className="kukui-osce__review-name">Phase order</span>
                  <span className="kukui-osce__review-score">
                    {scoring.order.raw} / {scoring.order.max}
                  </span>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
      </article>
    </div>
  );
}

type Scoring = {
  byPhase: Record<string, ScoreState>;
  order: ScoreState;
  total: ScoreState;
};

function computeScoring(config: OSCEConfig, state: State): Scoring {
  const byPhase: Record<string, ScoreState> = {};
  const phaseScores: ScoreState[] = [];
  // Default 1: a wrong selection subtracts 1 from the phase's earned points
  // (matches scoreSelection's behaviour). Set to 0 to disable penalty.
  const guessPenalty = config.behaviour?.guessPenalty ?? 1;

  for (const phase of config.phases) {
    const correctIndices = new Set(
      phase.actions.map((a, i) => (a.correct ? i : -1)).filter((i) => i >= 0),
    );
    const selectedIds = state.selectedByPhase[phase.id] ?? [];
    const selectedIndices = new Set(
      selectedIds
        .map((id) => phase.actions.findIndex((a) => a.id === id))
        .filter((i) => i >= 0),
    );

    const totalCorrect = correctIndices.size;
    let earned = 0;
    for (const i of selectedIndices) {
      if (correctIndices.has(i)) earned += 1;
      else earned -= guessPenalty;
    }
    const clamped = Math.max(0, Math.min(totalCorrect, earned));
    const ss: ScoreState = {
      raw: clamped,
      max: totalCorrect,
      success: clamped === totalCorrect && totalCorrect > 0,
    };
    byPhase[phase.id] = ss;
    phaseScores.push(ss);
  }

  // Order bonus: +1 weight per phase whose visit-order index matches expectedOrder.
  let orderRaw = 0;
  let orderMax = 0;
  if (config.expectedOrder && config.expectedOrder.length > 0) {
    orderMax = config.expectedOrder.length;
    for (let i = 0; i < config.expectedOrder.length; i += 1) {
      if (state.visitOrder[i] === config.expectedOrder[i]) {
        orderRaw += 1;
      }
    }
  }
  const order: ScoreState = {
    raw: orderRaw,
    max: orderMax,
    success: orderMax === 0 ? true : orderRaw === orderMax,
  };

  // Honor the authored pass threshold (config.scoring.passPercentage) instead
  // of aggregate's hard-coded 50% default. Falls back to 50 when no scoring
  // block is present, preserving prior behaviour for legacy fixtures.
  const passPercentage = resolveScoring(config, { mode: "points" }).passPercentage;
  const total = aggregate([...phaseScores, order], passPercentage);

  return { byPhase, order, total };
}

function parseSuspend(s: string | undefined, config: OSCEConfig): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (
      !parsed ||
      typeof parsed.current !== "number" ||
      typeof parsed.attempts !== "number"
    ) {
      return null;
    }
    if (parsed.current < 0 || parsed.current >= config.phases.length) return null;

    const knownPhaseIds = new Set(config.phases.map((p) => p.id));
    const knownActionIds = new Map<string, Set<string>>();
    for (const p of config.phases) {
      knownActionIds.set(p.id, new Set(p.actions.map((a) => a.id)));
    }

    const selectedByPhase: Record<string, string[]> = {};
    if (parsed.selectedByPhase && typeof parsed.selectedByPhase === "object") {
      for (const [pid, ids] of Object.entries(parsed.selectedByPhase)) {
        if (!knownPhaseIds.has(pid)) continue;
        if (!Array.isArray(ids)) continue;
        const validIds = ids.filter(
          (x): x is string =>
            typeof x === "string" && (knownActionIds.get(pid)?.has(x) ?? false),
        );
        selectedByPhase[pid] = validIds;
      }
    }

    const visitOrder = Array.isArray(parsed.visitOrder)
      ? parsed.visitOrder.filter(
          (x): x is string => typeof x === "string" && knownPhaseIds.has(x),
        )
      : [];

    return {
      stage: parsed.stage === "submitted" ? "submitted" : "answering",
      current: parsed.current,
      selectedByPhase,
      visitOrder: visitOrder.length > 0
        ? visitOrder
        : [config.phases[parsed.current]?.id ?? ""].filter(Boolean),
      attempts: parsed.attempts,
    };
  } catch {
    return null;
  }
}
