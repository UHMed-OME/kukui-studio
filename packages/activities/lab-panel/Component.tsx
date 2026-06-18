import { useEffect, useId, useMemo, useState } from "react";
import type { LabPanelConfig } from "./schema.js";
import { ActivityHeader, bandMessage, percentage, scoreSelection, SafeHtml, htmlToText, type ActivityProps } from "@kukui/core";
import { resolveScoring } from "@kukui/core/scoring";
import "./Component.css";

type Stage = "answering" | "submitted";

type State = {
  stage: Stage;
  /** Lab-row ids the learner has flagged as abnormal. */
  selectedRowIds: string[];
  /** Selected interpretation choice id, or null if none picked yet. */
  selectedChoiceId: string | null;
  attempts: number;
};

const initialState: State = {
  stage: "answering",
  selectedRowIds: [],
  selectedChoiceId: null,
  attempts: 0,
};

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<LabPanelConfig>) {
  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData) ?? initialState,
  );
  const headingId = useId();
  const interpretationLegendId = useId();

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(parseSuspend(suspendData) ?? initialState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const rowIds = useMemo(
    () => config.panel.values.map((v) => v.id),
    [config.panel.values],
  );
  const idToIndex = useMemo(() => {
    const m = new Map<string, number>();
    rowIds.forEach((id, i) => m.set(id, i));
    return m;
  }, [rowIds]);
  const abnormalIndices = useMemo(
    () =>
      new Set(
        config.panel.values
          .map((v, i) => (v.isAbnormal ? i : -1))
          .filter((i) => i >= 0),
      ),
    [config.panel.values],
  );
  const correctChoiceId = useMemo(
    () => config.interpretation.choices.find((c) => c.correct)?.id ?? null,
    [config.interpretation.choices],
  );

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const toggleRow = (id: string) => {
    if (state.stage !== "answering") return;
    setState((s) => {
      const has = s.selectedRowIds.includes(id);
      return {
        ...s,
        selectedRowIds: has
          ? s.selectedRowIds.filter((x) => x !== id)
          : [...s.selectedRowIds, id],
      };
    });
  };

  const pickChoice = (id: string) => {
    if (state.stage !== "answering") return;
    setState((s) => ({ ...s, selectedChoiceId: id }));
  };

  const selectedRowIdxs = useMemo(
    () =>
      state.selectedRowIds
        .map((id) => idToIndex.get(id))
        .filter((i): i is number => typeof i === "number"),
    [state.selectedRowIds, idToIndex],
  );

  const scoring = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);
  const isSinglePoint = scoring.mode === "all-or-nothing";

  const score = useMemo(() => {
    const rowScore = scoreSelection({
      selectedIndices: new Set(selectedRowIdxs),
      correctIndices: abnormalIndices,
      totalAnswers: config.panel.values.length,
      singlePoint: isSinglePoint,
    });
    const interpretationCorrect =
      state.selectedChoiceId !== null &&
      state.selectedChoiceId === correctChoiceId;

    if (isSinglePoint) {
      const exact = rowScore.success && interpretationCorrect;
      return { raw: exact ? 1 : 0, max: 1, success: exact };
    }
    const raw = rowScore.raw + (interpretationCorrect ? 1 : 0);
    const max = rowScore.max + 1;
    return { raw, max, success: raw === max };
  }, [
    selectedRowIdxs,
    abnormalIndices,
    config.panel.values.length,
    isSinglePoint,
    state.selectedChoiceId,
    correctChoiceId,
  ]);

  const canSubmit = state.selectedChoiceId !== null;

  const submit = () => {
    if (!canSubmit) return;
    setState((s) => ({ ...s, stage: "submitted", attempts: s.attempts + 1 }));
    onSubmit({
      ...score,
      suspendData: JSON.stringify({ ...state, stage: "submitted" }),
    });
  };

  const tryAgain = () => setState(initialState);

  const ui = config.ui ?? {};
  const checkLabel = ui.checkAnswerButton ?? "Check";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";

  const submitted = state.stage === "submitted";
  const pct = submitted ? percentage(score) : 0;
  const banner = submitted ? bandMessage(scoring.bands, pct) : null;

  return (
    <div className="kukui-lp">
      <article className="kukui-lp__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          prompt={config.prompt ? <SafeHtml html={config.prompt} /> : undefined}
        />

        <section
          className="kukui-lp__panel"
          aria-label={`${config.panel.name} — click rows you consider abnormal`}
        >
          <h2 className="kukui-lp__panel-name">{config.panel.name}</h2>
          <table className="kukui-lp__table">
            <caption className="kukui-lp__caption">
              Click each result row that is abnormal. Selected rows are
              outlined; the row header (analyte) is the toggle.
            </caption>
            <thead>
              <tr>
                <th scope="col">Analyte</th>
                <th scope="col">Result</th>
                <th scope="col">Units</th>
                <th scope="col">Reference</th>
              </tr>
            </thead>
            <tbody>
              {config.panel.values.map((v) => {
                const selected = state.selectedRowIds.includes(v.id);
                const isAbnormal = v.isAbnormal;
                const right = submitted && selected === isAbnormal;
                const wrong = submitted && selected !== isAbnormal;
                const stateLabel = right
                  ? selected
                    ? "marked abnormal, correct"
                    : "left as normal, correct"
                  : wrong
                    ? selected
                      ? "marked abnormal, incorrect — value is normal"
                      : "left as normal, incorrect — value is abnormal"
                    : selected
                      ? "marked abnormal"
                      : "not marked";
                const flagText =
                  v.flag && v.flag !== "normal" ? `, flag: ${v.flag}` : "";
                const aria = `Toggle ${v.analyte}, result ${v.result}${
                  v.units ? " " + v.units : ""
                }${
                  v.reference ? `, reference ${v.reference}` : ""
                }${flagText}, ${stateLabel}`;
                return (
                  <tr
                    key={v.id}
                    className={[
                      "kukui-lp__row",
                      selected ? "is-selected" : "",
                      right ? "is-correct" : "",
                      wrong ? "is-incorrect" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <th
                      scope="row"
                      className="kukui-lp__cell kukui-lp__cell--analyte"
                    >
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={aria}
                        disabled={submitted}
                        className="kukui-lp__cell-btn"
                        onClick={() => toggleRow(v.id)}
                      >
                        <span
                          className="kukui-lp__row-icon"
                          aria-hidden="true"
                        >
                          {right && selected
                            ? "✓"
                            : right && !selected
                              ? ""
                              : wrong
                                ? "✗"
                                : selected
                                  ? "●"
                                  : ""}
                        </span>
                        <span className="kukui-lp__analyte-text">
                          {v.analyte}
                        </span>
                      </button>
                    </th>
                    <td className="kukui-lp__cell kukui-lp__cell--result">
                      <span className="kukui-lp__result-text">{v.result}</span>
                      {v.flag && v.flag !== "normal" ? (
                        <span
                          className={`kukui-lp__flag is-${v.flag}`}
                          aria-label={v.flag === "high" ? "high" : "low"}
                        >
                          {v.flag === "high" ? "↑ H" : "↓ L"}
                        </span>
                      ) : null}
                    </td>
                    <td className="kukui-lp__cell kukui-lp__cell--units">
                      {v.units ?? ""}
                    </td>
                    <td className="kukui-lp__cell kukui-lp__cell--reference">
                      {v.reference ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <fieldset className="kukui-lp__interpretation">
          <legend
            id={interpretationLegendId}
            className="kukui-lp__legend"
          >
            Interpretation
          </legend>
          <SafeHtml
            className="kukui-lp__question"
            html={config.interpretation.question}
          />
          <ul
            role="radiogroup"
            aria-labelledby={interpretationLegendId}
            className="kukui-lp__choices"
          >
            {config.interpretation.choices.map((c) => {
              const selected = state.selectedChoiceId === c.id;
              const isCorrect = c.correct;
              const right = submitted && selected && isCorrect;
              const wrong = submitted && selected && !isCorrect;
              const reveal = submitted && !selected && isCorrect;
              const stateLabel = right
                ? "correct"
                : wrong
                  ? "incorrect"
                  : reveal
                    ? "correct, not selected"
                    : selected
                      ? "selected"
                      : "not selected";
              return (
                <li key={c.id} className="kukui-lp__choice-row">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${htmlToText(c.text)}, ${stateLabel}`}
                    disabled={submitted}
                    className={[
                      "kukui-lp__choice",
                      selected ? "is-selected" : "",
                      right ? "is-correct" : "",
                      wrong ? "is-incorrect" : "",
                      reveal ? "is-reveal" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => pickChoice(c.id)}
                  >
                    <SafeHtml
                      as="span"
                      className="kukui-lp__choice-text"
                      html={c.text}
                    />
                    <span
                      className="kukui-lp__choice-icon"
                      aria-hidden="true"
                    >
                      {right ? "✓" : wrong ? "✗" : reveal ? "○" : ""}
                    </span>
                  </button>
                  <div
                    className={[
                      "kukui-lp__feedback",
                      submitted && selected ? "is-visible" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-live="polite"
                  >
                    {submitted && selected && c.feedback ? c.feedback : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className="kukui-lp__actions">
          {!submitted ? (
            <button
              type="button"
              className="kukui-lp__primary"
              disabled={!canSubmit}
              onClick={submit}
            >
              {checkLabel}
            </button>
          ) : (
            <>
              <output className="kukui-lp__score">
                {score.raw} / {score.max}
                {banner ? (
                  <span className="kukui-lp__band"> — {banner}</span>
                ) : null}
              </output>
              {scoring.enableRetry ? (
                <button
                  type="button"
                  className="kukui-lp__secondary"
                  onClick={tryAgain}
                >
                  {tryAgainLabel}
                </button>
              ) : null}
            </>
          )}
        </div>
      </article>
    </div>
  );
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (
      parsed &&
      Array.isArray(parsed.selectedRowIds) &&
      typeof parsed.attempts === "number"
    ) {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "answering",
        selectedRowIds: parsed.selectedRowIds.filter(
          (x): x is string => typeof x === "string",
        ),
        selectedChoiceId:
          typeof parsed.selectedChoiceId === "string"
            ? parsed.selectedChoiceId
            : null,
        attempts: parsed.attempts,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
