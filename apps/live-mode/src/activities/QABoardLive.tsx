import { useMemo, useState, type ComponentType } from "react";
import type { LiveRoomHandle, Presence } from "@kukui/live";
import type { LiveActivityManifest, LiveActivityProps } from "./types.js";
import type { QABoardConfig } from "@kukui/schemas";
import { usePhase } from "../usePhase.js";
import { useQABoard, type QAQuestion } from "./useQABoard.js";
import "./LiveCommon.css";

export type QABoardLiveProps = {
  room: LiveRoomHandle;
  presence: Map<string, Presence>;
  role: "instructor" | "student";
  config: QABoardConfig;
  onLeave: () => void;
};

export function QABoardLive({
  room,
  presence,
  role,
  config,
  onLeave,
}: QABoardLiveProps) {
  const { phase, setPhase } = usePhase(room);
  const behaviour = config.behaviour ?? {};
  const allowAnon = behaviour.allowAnonymous !== false;
  const allowUpvoteOwn = behaviour.allowUpvoteOwn === true;
  const showAnsweredBelow = behaviour.showAnsweredBelow !== false;
  const maxLength = config.maxQuestionLength ?? 240;
  const maxQuestions = config.maxQuestionsPerStudent ?? 5;

  const { snapshot, postQuestion, toggleUpvote, markAnswered, clearAll } =
    useQABoard(room);
  const [draft, setDraft] = useState("");

  const isOpen = phase === "question" || phase === "discussion";
  const mePresence = presence.get(room.participantId);
  const displayName = mePresence?.name ?? "Anonymous";

  const sortedQuestions = useMemo(() => {
    const withCounts = snapshot.questions.map((q) => ({
      q,
      votes: snapshot.upvotesByQ.get(q.id)?.size ?? 0,
    }));
    withCounts.sort((a, b) => {
      // Move answered below open ones if behaviour requested.
      if (showAnsweredBelow && a.q.answered !== b.q.answered) {
        return a.q.answered ? 1 : -1;
      }
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.q.createdAt - b.q.createdAt;
    });
    return withCounts;
  }, [snapshot.questions, snapshot.upvotesByQ, showAnsweredBelow]);

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed.length > maxLength) return;
    if (snapshot.myQuestionCount >= maxQuestions) return;
    postQuestion(trimmed, allowAnon ? "Anonymous" : displayName);
    setDraft("");
  };

  if (role === "instructor") {
    const studentCount = [...presence.values()].filter((p) => p.role === "student").length;
    const reset = () => {
      if (!window.confirm("Reset and clear all questions and votes? This can't be undone.")) return;
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
            {studentCount} student{studentCount === 1 ? "" : "s"} connected ·{" "}
            {snapshot.questions.length} question{snapshot.questions.length === 1 ? "" : "s"}
          </p>
          <section className="kukui-live-prompt">
            <p>{config.prompt}</p>
          </section>
          <QuestionList
            entries={sortedQuestions}
            myId={room.participantId}
            myUpvotes={new Set(
              [...snapshot.upvotesByQ.entries()]
                .filter(([, v]) => v.has(room.participantId))
                .map(([k]) => k),
            )}
            onUpvote={toggleUpvote}
            onMarkAnswered={(id, answered) => markAnswered(id, answered)}
            instructorAlwaysSeesAuthor
            allowUpvoteOwn={allowUpvoteOwn}
          />
          <div className="kukui-live-controls" aria-label="Q&A controls">
            {phase === "lobby" ? (
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={() => setPhase("question")}
              >
                Open board
              </button>
            ) : null}
            {phase === "question" ? (
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

  const remaining = maxQuestions - snapshot.myQuestionCount;
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
        {phase === "lobby" ? (
          <div className="kukui-live-status" role="status" aria-live="polite">
            Waiting for the instructor to open the board…
          </div>
        ) : !isOpen ? (
          <div className="kukui-live-status" role="status" aria-live="polite">
            The board is closed — no new questions, but you can still read and upvote.
          </div>
        ) : null}
        {isOpen ? (
          <div className="kukui-qa__form">
            <textarea
              className="kukui-qa__textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
              placeholder={
                remaining > 0
                  ? "Type your question…"
                  : "You've used all your questions for this session"
              }
              disabled={remaining <= 0}
              aria-label="Your question"
            />
            <div className="kukui-qa__charcount">
              {draft.length} / {maxLength} · {remaining} question
              {remaining === 1 ? "" : "s"} remaining
            </div>
            <div>
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={handleSubmit}
                disabled={remaining <= 0 || draft.trim().length === 0}
              >
                Post
              </button>
            </div>
          </div>
        ) : null}
        <QuestionList
          entries={sortedQuestions}
          myId={room.participantId}
          myUpvotes={new Set(
            [...snapshot.upvotesByQ.entries()]
              .filter(([, v]) => v.has(room.participantId))
              .map(([k]) => k),
          )}
          onUpvote={toggleUpvote}
          allowUpvoteOwn={allowUpvoteOwn}
          hideAuthorIfAnonymous={allowAnon}
        />
        <div className="live-actions" style={{ marginTop: 16 }}>
          <button type="button" className="live-btn live-btn--ghost" onClick={onLeave}>
            Leave room
          </button>
        </div>
      </article>
    </div>
  );
}

function QuestionList({
  entries,
  myId,
  myUpvotes,
  onUpvote,
  onMarkAnswered,
  instructorAlwaysSeesAuthor = false,
  hideAuthorIfAnonymous = false,
  allowUpvoteOwn = false,
}: {
  entries: { q: QAQuestion; votes: number }[];
  myId: string;
  myUpvotes: Set<string>;
  onUpvote: (id: string) => void;
  onMarkAnswered?: (id: string, answered: boolean) => void;
  instructorAlwaysSeesAuthor?: boolean;
  hideAuthorIfAnonymous?: boolean;
  allowUpvoteOwn?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p style={{ fontSize: "var(--font-size-meta, 13px)", color: "var(--color-text-secondary)" }}>
        No questions yet — be the first to post.
      </p>
    );
  }
  return (
    <ol className="kukui-qa__list">
      {entries.map(({ q, votes }) => {
        const isMine = q.authorId === myId;
        const voted = myUpvotes.has(q.id);
        const showAuthor =
          instructorAlwaysSeesAuthor || !hideAuthorIfAnonymous || isMine;
        const upvoteDisabled = !allowUpvoteOwn && isMine;
        return (
          <li
            key={q.id}
            className={["kukui-qa__item", q.answered ? "is-answered" : ""]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              type="button"
              className={[
                "kukui-qa__upvote",
                voted ? "is-voted" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onUpvote(q.id)}
              disabled={upvoteDisabled}
              aria-pressed={voted}
              title={upvoteDisabled ? "You can't upvote your own question" : undefined}
              aria-label={
                upvoteDisabled
                  ? `${votes} votes — you can't upvote your own question`
                  : `Upvote — currently ${votes} votes`
              }
            >
              <span className="kukui-qa__upvote-arrow" aria-hidden="true">▲</span>
              <span className="kukui-qa__upvote-count">{votes}</span>
            </button>
            <div>
              <p className="kukui-qa__text">{q.text}</p>
              {q.answered ? (
                <span className="kukui-qa__answered-badge">✓ Answered</span>
              ) : null}
              {showAuthor ? (
                <span className="kukui-qa__author">
                  {isMine ? "You" : q.authorName}
                </span>
              ) : null}
            </div>
            {onMarkAnswered ? (
              <button
                type="button"
                className="kukui-qa__action"
                onClick={() => onMarkAnswered(q.id, !q.answered)}
              >
                {q.answered ? "Reopen" : "Mark answered"}
              </button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export const liveActivity: LiveActivityManifest<"qa-board"> = {
  kind: "qa-board",
  Component: QABoardLive as ComponentType<LiveActivityProps>,
};
