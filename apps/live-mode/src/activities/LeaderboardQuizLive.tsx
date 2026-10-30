import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
} from "react";
import type { LiveRoomHandle, Presence } from "@kukui/live";
import {
  answerLists,
  answerText,
  isComplete,
  isCorrect,
  promptParts,
  shuffled,
  type LeaderboardQuizConfig,
  type LeaderboardQuizQuestion,
} from "@kukui/activities/leaderboard-quiz/schema";
import { ImageCredit } from "@kukui/activities/leaderboard-quiz/Component";
import type { LiveActivityManifest, LiveActivityProps } from "./types.js";
import { usePhase } from "../usePhase.js";
import { useLeaderboardQuiz, type Pace, type RankedEntry } from "./useLeaderboardQuiz.js";
import "./LiveCommon.css";
import "./LeaderboardQuizLive.css";

type Status = "idle" | "playing" | "finished";

export type LeaderboardQuizLiveProps = {
  room: LiveRoomHandle;
  presence: Map<string, Presence>;
  role: "instructor" | "student";
  config: LeaderboardQuizConfig;
  onLeave: () => void;
};

function Board({ ranked, myId, limit }: { ranked: RankedEntry[]; myId: string; limit?: number }) {
  const rows = limit ? ranked.slice(0, limit) : ranked;
  if (rows.length === 0) return <p className="kukui-live-status">No scores yet</p>;
  return (
    <ol className="kukui-lq__board" aria-label="Leaderboard">
      {rows.map((r) => (
        <li key={r.id} className={r.id === myId ? "kukui-lq__row is-me" : "kukui-lq__row"}>
          <span className="kukui-lq__rank">{r.rank}</span>
          <span className="kukui-lq__name">
            {r.displayName}
            {r.id === myId ? " (you)" : ""}
          </span>
          <span className="kukui-lq__score">{r.score} pts</span>
          <span className="kukui-lq__state">
            {r.finishedAt === null ? "playing…" : `${Math.round(r.elapsedMs / 1000)}s`}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function LeaderboardQuizLive({
  room,
  presence,
  role,
  config,
  onLeave,
}: LeaderboardQuizLiveProps) {
  const { phase, setPhase } = usePhase(room, role);
  const {
    ranked,
    shuffle,
    setShuffle,
    showBoard,
    setShowBoard,
    pace,
    setPace,
    timeLimit,
    setTimeLimit,
    manual,
    startManual,
    setManualIndex,
    report,
    clearAll,
  } = useLeaderboardQuiz(
    room,
    role,
    config.round.shuffle ?? true,
    config.round.timeLimitSeconds ?? 60,
  );
  const formId = useId();
  // A student can hide the board for themselves, but only when the instructor has it enabled.
  const [hideBoard, setHideBoard] = useState(false);
  const boardVisible = showBoard && !hideBoard;
  const myName = presence.get(room.participantId)?.name ?? "Student";

  const [status, setStatus] = useState<Status>("idle");
  const [deck, setDeck] = useState<LeaderboardQuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  // Pace is locked in when the round starts; manual = the instructor sets the current question.
  const [mode, setMode] = useState<Pace>("auto");
  const [correct, setCorrect] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  // One entry per answered question (by deck position), for the end-of-round results.
  const [history, setHistory] = useState<Record<number, { given: string[]; ok: boolean }>>({});
  const [fb, setFb] = useState<{ ok: boolean; q: LeaderboardQuizQuestion } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef(0);

  const limitMs = timeLimit * 1000;
  const elapsed = Math.min(now - startedAt.current, limitMs);
  const left = Math.max(0, Math.ceil((limitMs - elapsed) / 1000));

  // Manual rounds have no countdown, so the clock isn't capped there.
  const elapsedNow = () =>
    mode === "manual"
      ? Date.now() - startedAt.current
      : Math.min(Date.now() - startedAt.current, limitMs);
  const curIdx = mode === "manual" ? Math.min(manual.index, deck.length - 1) : idx;

  const finish = (finalCorrect: number) => {
    if (status !== "playing") return;
    const ms = elapsedNow();
    report({
      displayName: myName,
      score: finalCorrect * config.pointsPerCorrect,
      elapsedMs: ms,
      finishedAt: Date.now(),
    });
    setFb(null);
    setStatus("finished");
  };

  // Student: the instructor opening the question starts everyone's round.
  // ponytail: each student's clock starts when they receive the phase change, so peers can skew by network latency; a shared epoch in room state would remove it.
  useEffect(() => {
    if (role !== "student") return;
    if (phase === "question" && status === "idle") {
      setMode(pace);
      if (pace === "manual") {
        setDeck(
          manual.deck
            .map((i) => config.questions[i])
            .filter((x): x is LeaderboardQuizQuestion => !!x),
        );
      } else {
        const d = shuffle ? shuffled(config.questions) : config.questions;
        setDeck(d.slice(0, config.round.questionCount));
      }
      setIdx(0);
      setCorrect(0);
      setAnswers([]);
      setHistory({});
      setFb(null);
      startedAt.current = Date.now();
      setNow(Date.now());
      setStatus("playing");
    } else if (phase === "lobby" && status !== "idle") {
      setStatus("idle");
    } else if (phase !== "question" && phase !== "lobby" && status === "playing") {
      // Instructor closed the round early.
      finish(correct);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, status, role]);

  // Countdown + time-up.
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [status]);
  useEffect(() => {
    if (status === "playing" && mode === "auto" && left <= 0) finish(correct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, status]);

  // Auto pace: feedback stays until the learner presses Next (or Enter), so screen readers can finish it.
  const advance = () => {
    setFb(null);
    setAnswers([]);
    if (idx + 1 >= deck.length) finish(correct);
    else setIdx(idx + 1);
  };

  // Manual pace: a new question from the instructor clears the previous answer.
  useEffect(() => {
    setFb(null);
    setAnswers([]);
  }, [manual.index]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = deck[curIdx];
    if (fb && mode === "auto") return advance();
    if (!q || fb || !isComplete(q, answers)) return;
    const ok = isCorrect(q, answers);
    const next = correct + (ok ? 1 : 0);
    setCorrect(next);
    setHistory((h) => ({ ...h, [curIdx]: { given: answers, ok } }));
    setFb({ ok, q });
    // Live-updating board: publish the running score after every answer.
    report({
      displayName: myName,
      score: next * config.pointsPerCorrect,
      elapsedMs: elapsedNow(),
      finishedAt: null,
    });
  };

  const header = (
    <div className="live-brand">
      <img className="live-logo" src="/kukui-logo.svg" alt="" aria-hidden="true" />
      <h1 className="live-title">{config.title}</h1>
    </div>
  );

  if (role === "instructor") {
    const students = [...presence.values()].filter((p) => p.role === "student").length;
    const finished = ranked.filter((r) => r.finishedAt !== null).length;
    const reset = () => {
      if (!window.confirm("Reset and clear all scores? This can't be undone.")) return;
      clearAll();
      setPhase("lobby");
    };
    const startRound = () => {
      if (pace === "manual") {
        // Everyone gets the same questions in the same order; publish it before opening the round.
        const order = config.questions.map((_, i) => i);
        startManual((shuffle ? shuffled(order) : order).slice(0, config.round.questionCount));
      }
      setPhase("question");
    };
    const manualPacing = pace === "manual" && phase === "question";
    const current = manualPacing ? config.questions[manual.deck[manual.index] ?? -1] : undefined;
    const lastQuestion = manual.index + 1 >= manual.deck.length;
    return (
      <div className="live-shell">
        <article className="live-card live-card--wide">
          {header}
          <p className="live-subtitle">
            {students} student{students === 1 ? "" : "s"} connected · {finished} finished
          </p>
          {current ? (
            <section
              className={
                current.image ? "kukui-live-prompt" : "kukui-live-prompt kukui-live-prompt--plain"
              }
            >
              <p>
                Question {manual.index + 1} of {manual.deck.length}: {current.prompt}
              </p>
              {current.image ? (
                <img
                  className="kukui-lq__image"
                  src={current.image.src}
                  alt={current.image.alt}
                  draggable={false}
                />
              ) : null}
            </section>
          ) : null}
          <Board ranked={ranked} myId={room.participantId} />
          {/* Pace and shuffle: only before the round starts; the board toggle sits between them. */}
          {phase === "lobby" ? (
            <>
              <div className="kukui-lq__settings">
                <label className="kukui-lq__toggle">
                  Question pace
                  <select value={pace} onChange={(e) => setPace(e.target.value as Pace)}>
                    <option value="auto">Automatic</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                {pace === "auto" ? (
                  <label className="kukui-lq__toggle">
                    Time limit (seconds)
                    <input
                      type="number"
                      min={1}
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.valueAsNumber)}
                    />
                  </label>
                ) : null}
              </div>
            </>
          ) : null}
          {/* Can be flipped any time, e.g. hide during the round and reveal at the end. */}
          <label className="kukui-lq__toggle">
            <input
              type="checkbox"
              checked={showBoard}
              onChange={(e) => setShowBoard(e.target.checked)}
            />
            Show leaderboard to students
          </label>
          {phase === "lobby" ? (
            <>
              <label className="kukui-lq__toggle">
                <input
                  type="checkbox"
                  checked={shuffle}
                  onChange={(e) => setShuffle(e.target.checked)}
                />
                Shuffle questions
              </label>
            </>
          ) : null}
          <div className="kukui-live-controls" aria-label="Leaderboard Quiz controls">
            {phase === "lobby" ? (
              <button type="button" className="live-btn live-btn--primary" onClick={startRound}>
                Start round
              </button>
            ) : null}
            {manualPacing ? (
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={() =>
                  lastQuestion ? setPhase("reveal") : setManualIndex(manual.index + 1)
                }
              >
                {lastQuestion ? "Finish & show results" : "Next question"}
              </button>
            ) : null}
            {phase === "question" ? (
              <button
                type="button"
                className={manualPacing ? "live-btn live-btn--ghost" : "live-btn live-btn--primary"}
                onClick={() => setPhase("reveal")}
              >
                End round &amp; show results
              </button>
            ) : null}
            {phase === "reveal" ? (
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={() => setPhase("ended")}
              >
                End activity
              </button>
            ) : null}
            {phase !== "lobby" ? (
              <button type="button" className="live-btn live-btn--ghost" onClick={reset}>
                Reset
              </button>
            ) : null}
            <button type="button" className="live-btn live-btn--ghost" onClick={onLeave}>
              Leave room
            </button>
          </div>
        </article>
      </div>
    );
  }

  const q = deck[curIdx];
  const parts = q ? promptParts(q) : null;
  const answerInputs = q
    ? answerLists(q).map((_, i) => (
        <input
          key={i}
          className={["kukui-lq__input", fb ? (fb.ok ? "is-correct" : "is-incorrect") : ""]
            .filter(Boolean)
            .join(" ")}
          value={answers[i] ?? ""}
          onChange={(e) => setAnswers((a) => Object.assign([...a], { [i]: e.target.value }))}
          readOnly={!!fb}
          aria-label={answerLists(q).length > 1 ? `Blank ${i + 1}` : "Your answer"}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={i === 0}
          form={formId}
        />
      ))
    : [];
  const mine = ranked.find((r) => r.id === room.participantId);

  return (
    <div className="live-shell">
      <article className="live-card live-card--wide">
        {header}

        {status === "idle" ? (
          <div className="kukui-live-status" role="status" aria-live="polite">
            Waiting for the instructor to start the round…
          </div>
        ) : null}

        {status === "playing" && q ? (
          <>
            <div className="kukui-lq__bar">
              <span>
                Question {curIdx + 1} of {deck.length}
              </span>
              <strong>{correct * config.pointsPerCorrect} pts</strong>
              {mode === "auto" ? <span role="timer">{left}s left</span> : null}
            </div>
            <section
              className={
                q.image ? "kukui-live-prompt" : "kukui-live-prompt kukui-live-prompt--plain"
              }
            >
              {parts ? (
                // The blank boxes live in the prompt box; they submit through the form below.
                <p className="kukui-lq__blank">
                  {parts.map((text, i) => (
                    <Fragment key={i}>
                      {text}
                      {answerInputs[i]}
                    </Fragment>
                  ))}
                </p>
              ) : (
                <p>{q.prompt}</p>
              )}
              {q.image ? (
                <img
                  className="kukui-lq__image"
                  src={q.image.src}
                  alt={q.image.alt}
                  draggable={false}
                />
              ) : null}
            </section>
            <form id={formId} className="kukui-lq__form" onSubmit={submit}>
              {parts ? null : answerInputs}
              <button
                type="submit"
                className="live-btn live-btn--primary"
                disabled={(!!fb && mode !== "auto") || (!fb && !isComplete(q, answers))}
              >
                {fb && mode === "auto" ? "Next" : "Submit"}
              </button>
            </form>
            {q.image?.attribution ? (
              <ImageCredit credit={q.image.attribution} className="kukui-lq__credit" />
            ) : null}
          </>
        ) : null}

        {status === "finished" ? (
          <p className="kukui-live-status" role="status" aria-live="polite">
            {phase === "question" ? "You're done. Waiting for the round to end…" : "Round over."}{" "}
            {mine ? (
              <>
                You scored <strong>{mine.score} pts</strong>
                {boardVisible ? ` (Rank ${mine.rank} of ${ranked.length})` : ""}.
              </>
            ) : null}
          </p>
        ) : null}

        {status === "finished" && (phase === "reveal" || phase === "ended") ? (
          <section className="kukui-lq__results" aria-label="Your results">
            <h2 className="kukui-lq__results-title">Your answers</h2>
            <ol className="kukui-lq__results-list">
              {deck.map((dq, i) => {
                const h = history[i];
                const fbText = h ? (h.ok ? dq.feedbackCorrect : dq.feedbackIncorrect) : undefined;
                return (
                  <li key={i} className="kukui-lq__result">
                    <p className="kukui-lq__result-q">
                      {i + 1}. {dq.prompt}
                    </p>
                    <p className="kukui-lq__result-status">
                      {h ? (h.ok ? "✓ Correct" : "✗ Incorrect") : "Not answered"}
                    </p>
                    {h ? <p>Your answer: {h.given.join(", ")}</p> : null}
                    {!h || !h.ok ? <p>Correct answer: {answerText(dq)}</p> : null}
                    {fbText ? <p>{fbText}</p> : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {status === "playing" && q ? (
          <>
            {/* Always rendered so feedback never reflows the card. */}
            <p
              className={
                fb
                  ? `kukui-lq__feedback ${fb.ok ? "is-correct" : "is-incorrect"}`
                  : "kukui-lq__feedback"
              }
              role="status"
              aria-live="polite"
            >
              {fb
                ? fb.ok
                  ? `✓ Correct.\n${fb.q.feedbackCorrect ?? ""}`
                  : `✗ Incorrect. Answer: ${answerText(fb.q)}\n${fb.q.feedbackIncorrect ?? ""}`
                : ""}
            </p>
          </>
        ) : null}

        {showBoard ? (
          <label className="kukui-lq__toggle">
            <input
              type="checkbox"
              checked={!hideBoard}
              onChange={(e) => setHideBoard(!e.target.checked)}
            />
            Show leaderboard
          </label>
        ) : null}
        {boardVisible && (status !== "idle" || phase === "reveal" || phase === "ended") ? (
          <Board ranked={ranked} myId={room.participantId} limit={10} />
        ) : null}

        <div className="live-actions" style={{ marginTop: 16 }}>
          <button type="button" className="live-btn live-btn--ghost" onClick={onLeave}>
            Leave room
          </button>
        </div>
      </article>
    </div>
  );
}

export const liveActivity: LiveActivityManifest<"leaderboard-quiz"> = {
  kind: "leaderboard-quiz",
  Component: LeaderboardQuizLive as ComponentType<LiveActivityProps>,
};
