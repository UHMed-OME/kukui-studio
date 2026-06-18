import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import type { ClinicalCaseConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { ActivityHeader, ActivityIcon, SafeHtml, SafeSvg, percentage } from "@kukui/core";
import { resolveScoring } from "@kukui/core/scoring";
import "./Component.css";

type Stage = "answering" | "submitted";

type State = {
  /** Index of the active section. */
  current: number;
  /** Highest section index the learner has reached (drives progress fill). */
  furthest: number;
  /** questionId -> selected option index. Presence means "answered". */
  answers: Record<string, number>;
  /** Quiz lifecycle. */
  stage: Stage;
  /** Selected activity-format id (chooser), or null. */
  selectedFormat: string | null;
  attempts: number;
};

type SectionId = "presentation" | "anatomy" | "diagnosis" | "quiz" | "activity";

function buildSections(config: ClinicalCaseConfig): { id: SectionId; name: string }[] {
  const s: { id: SectionId; name: string }[] = [
    { id: "presentation", name: config.presentation.label ?? "Presentation" },
    { id: "anatomy", name: config.anatomy.label ?? "Anatomy" },
    { id: "diagnosis", name: config.diagnosis.label ?? "Diagnosis" },
    { id: "quiz", name: config.quiz.label ?? "Quiz" },
  ];
  if (config.activity) s.push({ id: "activity", name: config.activity.label ?? "Activity" });
  return s;
}

function initialState(): State {
  return {
    current: 0,
    furthest: 0,
    answers: {},
    stage: "answering",
    selectedFormat: null,
    attempts: 0,
  };
}

/** Short labels for the progress bar (badge text can be long / emoji-led). */
const SHORT_LABEL: Record<SectionId, string> = {
  presentation: "Presentation",
  anatomy: "Anatomy",
  diagnosis: "Diagnosis",
  quiz: "Quiz",
  activity: "Activity",
};

const TONE_VAR: Record<string, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  error: "var(--color-error)",
  warning: "var(--color-warning)",
  info: "var(--color-info)",
  neutral: "var(--color-text-secondary)",
};

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<ClinicalCaseConfig>) {
  const H2 = `h${Math.min(headingLevel + 1, 3)}` as "h2" | "h3";
  const headingId = useId();
  const liveId = useId();

  const sections = useMemo(() => buildSections(config), [config]);
  const initial = useMemo<State>(() => initialState(), []);

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, config, sections.length) ?? initial,
  );

  // Reset local state when `config` changes externally (Studio Preview edit,
  // draft load). Reference equality on the prop — engine loads JSON once.
  useEffect(() => {
    setState(parseSuspend(suspendData, config, sections.length) ?? initialState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const resolved = useMemo(
    () => resolveScoring(config, { mode: "completion", passPercentage: 60 }),
    [config],
  );

  const questions = config.quiz.questions;
  const correctCount = useMemo(
    () => questions.filter((q) => state.answers[q.id] === q.correctIndex).length,
    [questions, state.answers],
  );
  const allAnswered = questions.every((q) => state.answers[q.id] !== undefined);
  const submitted = state.stage === "submitted";

  const section = sections[state.current];
  if (!section) return null;
  const isLast = state.current === sections.length - 1;
  const nextName = sections[state.current + 1]?.name;

  const goTo = (index: number) => {
    if (index < 0 || index >= sections.length) return;
    setState((s) => ({ ...s, current: index, furthest: Math.max(s.furthest, index) }));
  };

  const answer = (questionId: string, optionIndex: number) => {
    if (submitted) return;
    setState((s) =>
      s.answers[questionId] !== undefined
        ? s // answered questions lock (formative immediate-feedback model)
        : { ...s, answers: { ...s.answers, [questionId]: optionIndex } },
    );
  };

  const success = (): boolean => {
    if (resolved.mode === "completion") return true;
    if (resolved.mode === "all-or-nothing") return correctCount === questions.length;
    return percentage({ raw: correctCount, max: questions.length }) >= resolved.passPercentage;
  };

  const submit = () => {
    if (submitted || !allAnswered) return;
    const next: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    setState(next);
    onSubmit({
      raw: correctCount,
      max: questions.length,
      success: success(),
      suspendData: JSON.stringify(next),
    });
  };

  const tryAgain = () => setState((s) => ({ ...initialState(), current: s.current, furthest: s.furthest }));

  const chooseFormat = (id: string) =>
    setState((s) => ({ ...s, selectedFormat: s.selectedFormat === id ? null : id }));

  return (
    <div className="kukui-ccase">
      <article className="kukui-ccase__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          icon={config.icon ? <ActivityIcon value={config.icon} /> : undefined}
          meta={
            config.week || config.course || config.school
              ? [config.week, config.course, config.school].filter(Boolean).join(" · ")
              : undefined
          }
        />

        <nav className="kukui-ccase__progress" aria-label="Case sections">
          <ol className="kukui-ccase__progress-labels">
            {sections.map((sec, i) => {
              const isCurrent = i === state.current;
              const done = i < state.current;
              return (
                <li key={sec.id} className="kukui-ccase__progress-item">
                  <button
                    type="button"
                    className={[
                      "kukui-ccase__progress-label",
                      isCurrent ? "is-current" : "",
                      done ? "is-done" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`Section ${i + 1} of ${sections.length}: ${sec.name}${isCurrent ? ", current" : done ? ", completed" : ""}`}
                    onClick={() => goTo(i)}
                  >
                    {SHORT_LABEL[sec.id]}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="kukui-ccase__progress-bar" aria-hidden="true">
            {sections.map((sec, i) => (
              <span
                key={sec.id}
                className={`kukui-ccase__progress-seg${i <= state.current ? " is-filled" : ""}`}
              />
            ))}
          </div>
        </nav>

        <section
          className="kukui-ccase__section"
          aria-labelledby={`${headingId}-sec-${state.current}`}
        >
          {section.id === "presentation" && (
            <PresentationView config={config} headingId={headingId} H2={H2} />
          )}
          {section.id === "anatomy" && (
            <AnatomyView config={config} headingId={headingId} H2={H2} />
          )}
          {section.id === "diagnosis" && (
            <DiagnosisView config={config} headingId={headingId} H2={H2} />
          )}
          {section.id === "quiz" && (
            <QuizView
              config={config}
              headingId={headingId}
              H2={H2}
              answers={state.answers}
              submitted={submitted}
              onAnswer={answer}
            />
          )}
          {section.id === "activity" && config.activity && (
            <ActivityView
              config={config}
              headingId={headingId}
              H2={H2}
              selectedFormat={state.selectedFormat}
              onChoose={chooseFormat}
            />
          )}
        </section>

        <div
          id={liveId}
          className={`kukui-ccase__result${submitted ? " is-visible" : ""}`}
          role="status"
          aria-live="polite"
        >
          {submitted
            ? `Quiz: ${correctCount} of ${questions.length} correct (${percentage({ raw: correctCount, max: questions.length })}%).${
                config.quiz.scoreMessages?.[correctCount]
                  ? ` ${config.quiz.scoreMessages[correctCount]}`
                  : ""
              }`
            : ""}
        </div>

        <nav className="kukui-ccase__nav" aria-label="Section navigation">
          <button
            type="button"
            className="kukui-ccase__secondary"
            onClick={() => goTo(state.current - 1)}
            disabled={state.current === 0}
          >
            ← Back
          </button>
          <div className="kukui-ccase__nav-end">
            {section.id === "quiz" && !submitted && (
              <button
                type="button"
                className="kukui-ccase__primary"
                onClick={submit}
                disabled={!allAnswered}
              >
                Submit quiz
              </button>
            )}
            {submitted && resolved.enableRetry && (
              <button type="button" className="kukui-ccase__secondary" onClick={tryAgain}>
                Try again
              </button>
            )}
            {!isLast && (
              <button
                type="button"
                className="kukui-ccase__primary"
                onClick={() => goTo(state.current + 1)}
              >
                {nextName ? `Next: ${nextName} →` : "Next →"}
              </button>
            )}
            {isLast && config.activity?.submissionPlatform && (
              <span className="kukui-ccase__submit-note">
                Submit via {config.activity.submissionPlatform}
              </span>
            )}
          </div>
        </nav>

        {config.author && <p className="kukui-ccase__credit">By {config.author}</p>}
      </article>
    </div>
  );
}

/* -- Section views --------------------------------------------------------- */

type ViewProps = {
  config: ClinicalCaseConfig;
  headingId: string;
  H2: "h2" | "h3";
};

const FLAG_ICON: Record<string, string> = { normal: "✓", watch: "▲", alert: "⚠" };
const FLAG_WORD: Record<string, string> = { normal: "Normal", watch: "Watch", alert: "Alert" };
const FINDING_ICON: Record<string, string> = { present: "＋", absent: "−", neutral: "•" };
const FINDING_WORD: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  neutral: "Note",
};

function SectionHeader({
  H2,
  id,
  label,
  title,
  lead,
}: {
  H2: "h2" | "h3";
  id: string;
  label?: string;
  title: string;
  lead?: string;
}) {
  return (
    <header className="kukui-ccase__section-head">
      {label && <span className="kukui-ccase__badge">{label}</span>}
      <H2 id={id} className="kukui-ccase__section-title">
        {title}
      </H2>
      {lead && <SafeHtml className="kukui-ccase__lead" html={lead} />}
    </header>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="kukui-ccase__block">
      {title && <h3 className="kukui-ccase__block-title">{title}</h3>}
      {children}
    </div>
  );
}

function PresentationView({ config, headingId, H2 }: ViewProps) {
  const p = config.presentation;
  return (
    <>
      <SectionHeader H2={H2} id={`${headingId}-sec-0`} label={p.label} title={p.title} lead={p.lead} />

      <Card title="Chief complaint">
        <SafeHtml className="kukui-ccase__prose" html={p.chiefComplaint} />
      </Card>

      {p.vitals.length > 0 && (
        <Card title="Vital signs">
          <ul className="kukui-ccase__vitals">
            {p.vitals.map((v, i) => (
              <li key={i} className={`kukui-ccase__vital is-${v.flag}`}>
                <span className="kukui-ccase__vital-value">{v.value}</span>
                <span className="kukui-ccase__vital-label">{v.label}</span>
                <span className="kukui-ccase__vital-flag">
                  <span className="kukui-ccase__flag-icon" aria-hidden="true">
                    {FLAG_ICON[v.flag]}
                  </span>
                  <span>{v.flagText ?? FLAG_WORD[v.flag]}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {p.examFindings.length > 0 && (
        <Card title="Examination findings">
          <ul className="kukui-ccase__findings">
            {p.examFindings.map((finding, i) => (
              <li key={i} className={`kukui-ccase__finding is-${finding.type}`}>
                <span className="kukui-ccase__finding-icon" aria-hidden="true">
                  {FINDING_ICON[finding.type]}
                </span>
                <span className="kukui-ccase__sr-only">{FINDING_WORD[finding.type]}: </span>
                <SafeHtml as="span" className="kukui-ccase__finding-text" html={finding.text} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {p.labResults && p.labResults.length > 0 && (
        <Card title="Lab results">
          <ul className="kukui-ccase__labs">
            {p.labResults.map((lab, i) => (
              <li key={i}>
                <SafeHtml as="span" html={lab.text} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {p.reflectionPrompt && (
        <SafeHtml className="kukui-ccase__cue" html={p.reflectionPrompt} />
      )}
    </>
  );
}

function AnatomyView({ config, headingId, H2 }: ViewProps) {
  const a = config.anatomy;
  return (
    <>
      <SectionHeader H2={H2} id={`${headingId}-sec-1`} label={a.label} title={a.title} lead={a.lead} />

      {a.imagingFinding && (
        <Card title="Imaging finding">
          <SafeHtml className="kukui-ccase__prose" html={a.imagingFinding} />
        </Card>
      )}

      {a.diagram && (
        <figure className="kukui-ccase__figure">
          {a.diagram.svg ? (
            <SafeSvg className="kukui-ccase__diagram" svg={a.diagram.svg} title={a.diagram.alt} />
          ) : a.diagram.src ? (
            <img className="kukui-ccase__diagram" src={a.diagram.src} alt={a.diagram.alt} />
          ) : null}
          {a.diagram.caption && (
            <figcaption className="kukui-ccase__figcaption">{a.diagram.caption}</figcaption>
          )}
        </figure>
      )}

      {a.diagramLegend && a.diagramLegend.length > 0 && (
        <ul className="kukui-ccase__legend">
          {a.diagramLegend.map((entry, i) => (
            <li key={i} className="kukui-ccase__legend-item">
              <span
                className="kukui-ccase__legend-swatch"
                aria-hidden="true"
                style={{ background: TONE_VAR[entry.tone ?? "neutral"] }}
              />
              {entry.label}
            </li>
          ))}
        </ul>
      )}

      {a.spaces && a.spaces.length > 0 && (
        <Card title="Anatomical spaces">
          {a.spaces.map((sp, i) => (
            <details key={i} className="kukui-ccase__space">
              <summary className="kukui-ccase__space-name">{sp.name}</summary>
              <SafeHtml className="kukui-ccase__prose" html={sp.detail} />
            </details>
          ))}
        </Card>
      )}

      {a.notes && a.notes.length > 0 && (
        <Card title="Anatomy notes">
          <ul className="kukui-ccase__notes">
            {a.notes.map((note, i) => (
              <li
                key={i}
                className={`kukui-ccase__note${note.highlight ? " is-highlight" : ""}`}
              >
                {note.highlight && <span className="kukui-ccase__sr-only">Key note: </span>}
                <SafeHtml as="span" html={note.text} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

const VERDICT_ICON: Record<string, string> = { in: "✓", out: "✗" };
const VERDICT_WORD: Record<string, string> = { in: "Ruled in", out: "Ruled out" };

function DiagnosisView({ config, headingId, H2 }: ViewProps) {
  const d = config.diagnosis;
  return (
    <>
      <SectionHeader H2={H2} id={`${headingId}-sec-2`} label={d.label} title={d.title} lead={d.lead} />

      {d.keyFinding && (
        <div className="kukui-ccase__keyfinding">
          <h3 className="kukui-ccase__block-title">Key finding</h3>
          <SafeHtml className="kukui-ccase__prose" html={d.keyFinding} />
        </div>
      )}

      {d.differential && d.differential.length > 0 && (
        <Card title="Differential diagnosis">
          <ul className="kukui-ccase__differential">
            {d.differential.map((item, i) => (
              <li key={i} className={`kukui-ccase__dx is-${item.verdict}`}>
                <span className="kukui-ccase__dx-icon" aria-hidden="true">
                  {VERDICT_ICON[item.verdict]}
                </span>
                <span className="kukui-ccase__sr-only">{VERDICT_WORD[item.verdict]}: </span>
                <SafeHtml as="span" html={item.text} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {d.causes && d.causes.length > 0 && (
        <Card title="Aetiology">
          <ul className="kukui-ccase__causes">
            {d.causes.map((cause, i) => (
              <li key={i} className="kukui-ccase__chip">
                {cause}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {d.management && d.management.length > 0 && (
        <Card title="Management">
          <ol className="kukui-ccase__management">
            {d.management.map((step, i) => (
              <li key={i} className={`kukui-ccase__step${step.urgent ? " is-urgent" : ""}`}>
                {step.urgent && <span className="kukui-ccase__priority">Priority</span>}
                <SafeHtml as="span" html={step.text} />
              </li>
            ))}
          </ol>
        </Card>
      )}

      {d.references && d.references.length > 0 && (
        <Card title="References">
          <ol className="kukui-ccase__references">
            {d.references.map((ref, i) => (
              <li key={i}>
                <SafeHtml as="span" html={ref} />
              </li>
            ))}
          </ol>
        </Card>
      )}
    </>
  );
}

function QuizView({
  config,
  headingId,
  H2,
  answers,
  submitted,
  onAnswer,
}: ViewProps & {
  answers: Record<string, number>;
  submitted: boolean;
  onAnswer: (questionId: string, optionIndex: number) => void;
}) {
  const q = config.quiz;
  return (
    <>
      <SectionHeader
        H2={H2}
        id={`${headingId}-sec-3`}
        label={q.label}
        title={q.title ?? "Check your understanding"}
        lead={q.lead}
      />

      <ol className="kukui-ccase__questions">
        {q.questions.map((question, qi) => {
          const selected = answers[question.id];
          const answered = selected !== undefined;
          const fbId = `${headingId}-q${qi}-fb`;
          return (
            <li key={question.id} className="kukui-ccase__question">
              <p className="kukui-ccase__stem">{question.question}</p>
              <ul
                className="kukui-ccase__options"
                role="group"
                aria-label={`Question ${qi + 1}`}
              >
                {question.options.map((opt, oi) => {
                  const isSelected = selected === oi;
                  const isCorrect = answered && oi === question.correctIndex;
                  const isWrongPick = answered && isSelected && oi !== question.correctIndex;
                  return (
                    <li key={oi} className="kukui-ccase__option-row">
                      <button
                        type="button"
                        className={[
                          "kukui-ccase__option",
                          isSelected ? "is-selected" : "",
                          isCorrect ? "is-correct" : "",
                          isWrongPick ? "is-incorrect" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={isSelected}
                        aria-describedby={answered && isSelected ? fbId : undefined}
                        disabled={answered || submitted}
                        onClick={() => onAnswer(question.id, oi)}
                      >
                        <span className="kukui-ccase__option-text">{opt}</span>
                        <span className="kukui-ccase__option-icon" aria-hidden="true">
                          {isCorrect ? "✓" : isWrongPick ? "✗" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div
                id={fbId}
                className={`kukui-ccase__feedback${answered ? " is-visible" : ""}`}
                aria-live="polite"
              >
                {answered && question.feedbackPerOption?.[selected]
                  ? question.feedbackPerOption[selected]
                  : ""}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function ActivityView({
  config,
  headingId,
  H2,
  selectedFormat,
  onChoose,
}: ViewProps & {
  selectedFormat: string | null;
  onChoose: (id: string) => void;
}) {
  const act = config.activity;
  if (!act) return null;
  return (
    <>
      <SectionHeader
        H2={H2}
        id={`${headingId}-sec-4`}
        label={act.label}
        title={act.title ?? "Choose your format"}
        lead={act.lead}
      />

      {act.objectives && act.objectives.length > 0 && (
        <Card title="Learning objectives">
          <ul className="kukui-ccase__objectives">
            {act.objectives.map((obj, i) => (
              <li key={i} className="kukui-ccase__objective">
                <span className="kukui-ccase__objective-text">{obj.text}</span>
                {obj.hint && <span className="kukui-ccase__objective-hint">{obj.hint}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Format options">
        <ul className="kukui-ccase__formats">
          {act.formats.map((fmt) => {
            const isSelected = selectedFormat === fmt.id;
            return (
              <li key={fmt.id} className="kukui-ccase__format-row">
                <button
                  type="button"
                  className={`kukui-ccase__format${isSelected ? " is-selected" : ""}`}
                  aria-expanded={isSelected}
                  onClick={() => onChoose(fmt.id)}
                >
                  {fmt.icon && (
                    <span className="kukui-ccase__format-icon" aria-hidden="true">
                      {fmt.icon}
                    </span>
                  )}
                  <span className="kukui-ccase__format-body">
                    <span className="kukui-ccase__format-name">{fmt.name}</span>
                    {fmt.desc && <span className="kukui-ccase__format-desc">{fmt.desc}</span>}
                  </span>
                  <span className="kukui-ccase__format-caret" aria-hidden="true">
                    {isSelected ? "▾" : "▸"}
                  </span>
                </button>
                {isSelected && (
                  <div className="kukui-ccase__format-detail">
                    <SafeHtml className="kukui-ccase__prose" html={fmt.guidance} />
                    {fmt.submission && (
                      <SafeHtml className="kukui-ccase__submission" html={fmt.submission} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {act.submissionPlatform && (
        <p className="kukui-ccase__platform">Submit to: {act.submissionPlatform}</p>
      )}
    </>
  );
}

/* -- Suspend ---------------------------------------------------------------- */

function parseSuspend(
  s: string | undefined,
  config: ClinicalCaseConfig,
  sectionCount: number,
): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (!parsed || typeof parsed.current !== "number") return null;
    const current =
      parsed.current >= 0 && parsed.current < sectionCount ? parsed.current : 0;
    const furthest =
      typeof parsed.furthest === "number" && parsed.furthest >= current && parsed.furthest < sectionCount
        ? parsed.furthest
        : current;

    const knownQ = new Set(config.quiz.questions.map((q) => q.id));
    const answers: Record<string, number> = {};
    if (parsed.answers && typeof parsed.answers === "object") {
      for (const [qid, idx] of Object.entries(parsed.answers)) {
        if (knownQ.has(qid) && typeof idx === "number") answers[qid] = idx;
      }
    }

    const formatIds = new Set(config.activity?.formats.map((f) => f.id) ?? []);
    const selectedFormat =
      typeof parsed.selectedFormat === "string" && formatIds.has(parsed.selectedFormat)
        ? parsed.selectedFormat
        : null;

    return {
      current,
      furthest,
      answers,
      stage: parsed.stage === "submitted" ? "submitted" : "answering",
      selectedFormat,
      attempts: typeof parsed.attempts === "number" ? parsed.attempts : 0,
    };
  } catch {
    return null;
  }
}
