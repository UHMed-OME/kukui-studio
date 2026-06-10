import { useMemo, type ComponentType } from "react";
import type * as Y from "yjs";
import { useEffect, useState } from "react";
import type { LiveRoomHandle, Presence } from "@kukui/live";
import type { LiveActivityManifest, LiveActivityProps } from "./types.js";
import type { QuickQuizConfig } from "@kukui/schemas";
import { usePhase } from "../usePhase.js";
import "./LiveCommon.css";

const ANSWERS_KEY = "quick-quiz-answers";

type AnswerSnapshot = {
  values: string[]; // each entry = chosen choiceId
  myAnswer: string | undefined;
  byParticipant: Record<string, string>; // participantId → chosen choiceId
};

function useAnswers(room: LiveRoomHandle): {
  snapshot: AnswerSnapshot;
  answer(choiceId: string): void;
  clearAll(): void;
} {
  const map = room.doc.getMap<string>(ANSWERS_KEY);
  const [snapshot, setSnapshot] = useState(() => read(map, room.participantId));

  useEffect(() => {
    const handler = () => setSnapshot(read(map, room.participantId));
    map.observe(handler);
    return () => map.unobserve(handler);
  }, [map, room.participantId]);

  return {
    snapshot,
    answer: (choiceId: string) => {
      room.doc.transact(() => {
        map.set(room.participantId, choiceId);
      });
    },
    clearAll: () => {
      room.doc.transact(() => map.clear());
    },
  };
}

function read(map: Y.Map<string>, myId: string): AnswerSnapshot {
  const values: string[] = [];
  const byParticipant: Record<string, string> = {};
  let myAnswer: string | undefined;
  map.forEach((v: string, k: string) => {
    if (typeof v !== "string") return;
    values.push(v);
    byParticipant[k] = v;
    if (k === myId) myAnswer = v;
  });
  return { values, myAnswer, byParticipant };
}

export type QuickQuizLiveProps = {
  room: LiveRoomHandle;
  presence: Map<string, Presence>;
  role: "instructor" | "student";
  config: QuickQuizConfig;
  onLeave: () => void;
};

export function QuickQuizLive({
  room,
  presence,
  role,
  config,
  onLeave,
}: QuickQuizLiveProps) {
  const { phase, setPhase } = usePhase(room, role);
  const behaviour = config.behaviour ?? {};
  const showLive = behaviour.showLiveResultsToStudents === true;
  const revealCorrect = behaviour.revealCorrectAnswer !== false;
  const allowChange = behaviour.allowChangeAnswer !== false;
  const showNames = behaviour.showNamesAtReveal === true;

  const { snapshot, answer, clearAll } = useAnswers(room);
  const isOpen = phase === "question";
  const isRevealed =
    phase === "reveal" || phase === "discussion" || phase === "ended";

  const counts = useMemo(() => {
    const out: Record<string, number> = Object.fromEntries(
      config.choices.map((c) => [c.id, 0]),
    );
    for (const v of snapshot.values) {
      if (Object.prototype.hasOwnProperty.call(out, v)) out[v] = (out[v] ?? 0) + 1;
    }
    return out;
  }, [snapshot.values, config.choices]);
  const total = snapshot.values.length;

  const correctIds = new Set(config.choices.filter((c) => c.correct).map((c) => c.id));

  if (role === "instructor") {
    const studentCount = [...presence.values()].filter((p) => p.role === "student").length;
    // At reveal, optionally name the students who picked a correct answer.
    // Answers and presence are both keyed by participantId, so we can join
    // them directly. Names are anonymous handles (e.g. "Guest-A37").
    const correctNames =
      showNames && isRevealed
        ? [...presence.values()]
            .filter((p) => p.role === "student")
            .filter((p) => {
              const ans = snapshot.byParticipant[p.id];
              return ans !== undefined && correctIds.has(ans);
            })
            .map((p) => p.name)
        : [];
    const reset = () => {
      if (!window.confirm("Reset and clear all answers? This can't be undone.")) return;
      clearAll();
      setPhase("lobby");
    };
    return (
      <div className="live-shell">
        <article className="live-card live-card--wide">
          <div className="live-brand">
            <img className="live-logo" src="/kukui-logo.svg" alt="" aria-hidden="true" />
            <h1 className="live-title">{config.title}</h1>
          </div>
          <p className="live-subtitle">
            {studentCount} student{studentCount === 1 ? "" : "s"} connected · {total} answer
            {total === 1 ? "" : "s"} in
          </p>
          <section className="kukui-live-prompt">
            <p>{config.prompt}</p>
          </section>
          <fieldset className="kukui-qq__choices">
            {config.choices.map((choice, idx) => {
              const count = counts[choice.id] ?? 0;
              const pct = total === 0 ? 0 : (count / total) * 100;
              const isCorrect = correctIds.has(choice.id);
              return (
                <div
                  key={choice.id}
                  className={[
                    "kukui-qq__choice",
                    isRevealed && isCorrect ? "is-correct" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="kukui-qq__letter">{String.fromCharCode(65 + idx)}</span>
                  <span className="kukui-qq__choice-text">{choice.label}</span>
                  <span className="kukui-qq__choice-meta">
                    {count} · {Math.round(pct)}%{isRevealed && isCorrect ? " ✓" : ""}
                  </span>
                </div>
              );
            })}
          </fieldset>
          {showNames && isRevealed ? (
            <p className="kukui-live-status" role="status" aria-live="polite">
              {correctNames.length > 0
                ? `Answered correctly (${correctNames.length}): ${correctNames.join(", ")}`
                : "No correct answers yet."}
            </p>
          ) : null}
          <div className="kukui-live-controls" aria-label="Quick Quiz controls">
            {phase === "lobby" ? (
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={() => setPhase("question")}
              >
                Open question
              </button>
            ) : null}
            {phase === "question" ? (
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={() => setPhase("reveal")}
              >
                Close &amp; reveal
              </button>
            ) : null}
            {phase === "reveal" ? (
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={() => setPhase("discussion")}
              >
                Move to discussion
              </button>
            ) : null}
            {phase === "discussion" ? (
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

  const hasAnswered = snapshot.myAnswer !== undefined;
  const canAnswer = isOpen && (allowChange || !hasAnswered);
  const studentSeesResults = isRevealed || (showLive && hasAnswered);

  return (
    <div className="live-shell">
      <article className="live-card live-card--wide">
        <div className="live-brand">
          <img className="live-logo" src="/kukui-logo.svg" alt="" aria-hidden="true" />
          <h1 className="live-title">{config.title}</h1>
        </div>
        <section className="kukui-live-prompt">
          <p>{config.prompt}</p>
        </section>
        {!isOpen && !isRevealed ? (
          <div className="kukui-live-status" role="status" aria-live="polite">
            Waiting for the instructor to open the question…
          </div>
        ) : null}
        {(isOpen || isRevealed) ? (
          <fieldset className="kukui-qq__choices" disabled={!canAnswer}>
            {config.choices.map((choice, idx) => {
              const isMine = snapshot.myAnswer === choice.id;
              const isCorrect = isRevealed && revealCorrect && correctIds.has(choice.id);
              const isIncorrectMine =
                isRevealed && revealCorrect && isMine && !correctIds.has(choice.id);
              const count = counts[choice.id] ?? 0;
              const pct = total === 0 ? 0 : (count / total) * 100;
              return (
                <button
                  key={choice.id}
                  type="button"
                  className={[
                    "kukui-qq__choice",
                    isMine ? "is-selected" : "",
                    isCorrect ? "is-correct" : "",
                    isIncorrectMine ? "is-incorrect" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => canAnswer && answer(choice.id)}
                  aria-pressed={isMine}
                >
                  <span className="kukui-qq__letter">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="kukui-qq__choice-text">{choice.label}</span>
                  <span className="kukui-qq__choice-meta">
                    {studentSeesResults
                      ? `${count} · ${Math.round(pct)}%`
                      : isMine
                        ? "your pick"
                        : ""}
                  </span>
                </button>
              );
            })}
          </fieldset>
        ) : null}
        {isRevealed && revealCorrect && hasAnswered ? (
          <p
            className="kukui-live-status"
            role="status"
            aria-live="polite"
            style={{
              background:
                snapshot.myAnswer && correctIds.has(snapshot.myAnswer)
                  ? "color-mix(in srgb, #2e6e41 12%, var(--color-surface))"
                  : "color-mix(in srgb, #c34132 12%, var(--color-surface))",
            }}
          >
            {snapshot.myAnswer && correctIds.has(snapshot.myAnswer)
              ? "Correct ✓"
              : "Not this time — review the highlighted answer above."}
          </p>
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

export const liveActivity: LiveActivityManifest<"quick-quiz"> = {
  kind: "quick-quiz",
  Component: QuickQuizLive as ComponentType<LiveActivityProps>,
};
