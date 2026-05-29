import { useMemo, type ComponentType } from "react";
import type { LiveRoomHandle, Presence } from "@kukui/live";
import type { LiveActivityManifest, LiveActivityProps } from "./types.js";
import type { StrawPollConfig } from "@kukui/schemas";
import { usePhase } from "../usePhase.js";
import { useStrawPoll, type Tally } from "./useStrawPoll.js";
import "./StrawPollLive.css";

export type StrawPollLiveProps = {
  room: LiveRoomHandle;
  presence: Map<string, Presence>;
  role: "instructor" | "student";
  config: StrawPollConfig;
  onLeave: () => void;
};

/**
 * Live runtime for the Straw Poll.
 *
 * One room → one open question → N students each cast one vote. The
 * instructor opens the poll (advance to "question"), watches the tally
 * climb, then advances to "reveal" / "discussion" / "ended" through the
 * existing phase machinery (so all Live activities share the same shape).
 *
 * Voting opens during the "question" phase. During "lobby" the student
 * sees a waiting state; during "reveal" / "discussion" / "ended" voting
 * is locked and the final tally is visible to everyone. The
 * `showLiveResultsToStudents` flag (default true) controls whether
 * students see the tally before reveal.
 */
export function StrawPollLive({
  room,
  presence,
  role,
  config,
  onLeave,
}: StrawPollLiveProps) {
  const { phase, setPhase } = usePhase(room);
  const choiceIds = useMemo(() => config.choices.map((c) => c.id), [config.choices]);
  const { myVote, tally, vote, clearAll, voterCount } = useStrawPoll(room, choiceIds);

  const behaviour = config.behaviour ?? {};
  const showLiveResults = behaviour.showLiveResultsToStudents !== false;
  const allowChangeVote = behaviour.allowChangeVote !== false;

  const isOpen = phase === "question";
  const isRevealed = phase === "reveal" || phase === "discussion" || phase === "ended";
  const studentSeesResults = isRevealed || (showLiveResults && myVote !== undefined);

  if (role === "instructor") {
    return (
      <InstructorView
        room={room}
        presence={presence}
        config={config}
        phase={phase}
        setPhase={setPhase}
        tally={tally}
        voterCount={voterCount}
        clearAll={clearAll}
        onLeave={onLeave}
      />
    );
  }

  return (
    <StudentView
      room={room}
      config={config}
      isOpen={isOpen}
      isRevealed={isRevealed}
      studentSeesResults={studentSeesResults}
      allowChangeVote={allowChangeVote}
      myVote={myVote}
      tally={tally}
      onVote={vote}
      onLeave={onLeave}
    />
  );
}

function InstructorView({
  room,
  presence,
  config,
  phase,
  setPhase,
  tally,
  voterCount,
  clearAll,
  onLeave,
}: {
  room: LiveRoomHandle;
  presence: Map<string, Presence>;
  config: StrawPollConfig;
  phase: string;
  setPhase: (next: "lobby" | "question" | "reveal" | "discussion" | "ended") => void;
  tally: Tally;
  voterCount: number;
  clearAll: () => void;
  onLeave: () => void;
}) {
  const ui = config.ui ?? {};
  const openLabel = ui.openPollButton ?? "Open poll";
  const closeLabel = ui.closePollButton ?? "Close & reveal";
  const resetLabel = ui.resetButton ?? "Reset poll";
  const studentCount = [...presence.values()].filter((p) => p.role === "student").length;

  const reset = () => {
    if (!window.confirm("Reset the poll and clear all votes? This can't be undone.")) return;
    clearAll();
    setPhase("lobby");
  };

  return (
    <div className="live-shell">
      <article className="live-card live-card--wide" aria-label="Straw poll — instructor">
        <div className="live-brand">
          <img className="live-logo" src="/kukui-logo.svg" alt="" aria-hidden="true" />
          <h1 className="live-title">{config.title}</h1>
        </div>
        <p className="live-subtitle">
          Room <code>{room.code.slice(0, 8)}…</code> · {studentCount} student
          {studentCount === 1 ? "" : "s"} connected · {voterCount} vote
          {voterCount === 1 ? "" : "s"} cast
        </p>

        <section className="kukui-sp-live__prompt-card">
          <p className="kukui-sp-live__prompt">{config.prompt}</p>
        </section>

        <section
          aria-labelledby="sp-tally-heading"
          className="kukui-sp-live__tally"
        >
          <h2 id="sp-tally-heading" className="kukui-sp-live__tally-heading">
            Live tally
          </h2>
          <TallyBars
            choices={config.choices}
            tally={tally}
            highlight={phase === "reveal" || phase === "discussion" || phase === "ended"}
          />
        </section>

        <section className="kukui-sp-live__controls" aria-label="Poll controls">
          {phase === "lobby" ? (
            <button
              type="button"
              className="live-btn live-btn--primary"
              onClick={() => setPhase("question")}
            >
              {openLabel}
            </button>
          ) : null}
          {phase === "question" ? (
            <button
              type="button"
              className="live-btn live-btn--primary"
              onClick={() => setPhase("reveal")}
            >
              {closeLabel}
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
              {resetLabel}
            </button>
          ) : null}
          <button type="button" className="live-btn live-btn--ghost" onClick={onLeave}>
            Leave room
          </button>
        </section>
      </article>
    </div>
  );
}

function StudentView({
  room,
  config,
  isOpen,
  isRevealed,
  studentSeesResults,
  allowChangeVote,
  myVote,
  tally,
  onVote,
  onLeave,
}: {
  room: LiveRoomHandle;
  config: StrawPollConfig;
  isOpen: boolean;
  isRevealed: boolean;
  studentSeesResults: boolean;
  allowChangeVote: boolean;
  myVote: string | undefined;
  tally: Tally;
  onVote: (choiceId: string) => void;
  onLeave: () => void;
}) {
  const ui = config.ui ?? {};
  const changeLabel = ui.changeVoteButton ?? "Change vote";
  const hasVoted = myVote !== undefined;
  const canTap = isOpen && (allowChangeVote || !hasVoted);

  return (
    <div className="live-shell">
      <article className="live-card live-card--wide" aria-label="Straw poll — student">
        <div className="live-brand">
          <img className="live-logo" src="/kukui-logo.svg" alt="" aria-hidden="true" />
          <h1 className="live-title">{config.title}</h1>
        </div>
        <p className="live-subtitle">
          Room <code>{room.code.slice(0, 8)}…</code>
        </p>

        <section className="kukui-sp-live__prompt-card">
          <p className="kukui-sp-live__prompt">{config.prompt}</p>
        </section>

        {!isOpen && !isRevealed ? (
          <div className="kukui-sp-live__status" role="status" aria-live="polite">
            Waiting for the instructor to open the poll…
          </div>
        ) : null}

        {isOpen ? (
          <fieldset
            className="kukui-sp-live__choices"
            aria-label="Cast your vote"
            disabled={!canTap}
          >
            {config.choices.map((choice, idx) => {
              const isMine = myVote === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  className={[
                    "kukui-sp-live__choice-btn",
                    isMine ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onVote(choice.id)}
                  aria-pressed={isMine}
                >
                  <span className="kukui-sp-live__choice-marker" aria-hidden="true">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="kukui-sp-live__choice-text">
                    <span className="kukui-sp-live__choice-label">{choice.label}</span>
                    {choice.description ? (
                      <span className="kukui-sp-live__choice-desc">{choice.description}</span>
                    ) : null}
                  </span>
                  {isMine ? (
                    <span className="kukui-sp-live__choice-tick" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </fieldset>
        ) : null}

        {isOpen && hasVoted ? (
          <p className="kukui-sp-live__hint" role="status" aria-live="polite">
            Vote recorded.{" "}
            {allowChangeVote ? (
              <span>You can {changeLabel.toLowerCase()} before the instructor closes the poll.</span>
            ) : (
              <span>Your vote is locked in.</span>
            )}
          </p>
        ) : null}

        {studentSeesResults ? (
          <section
            aria-labelledby="sp-student-tally-heading"
            className="kukui-sp-live__tally"
          >
            <h2 id="sp-student-tally-heading" className="kukui-sp-live__tally-heading">
              {isRevealed ? "Final results" : "Live results"}
            </h2>
            <TallyBars
              choices={config.choices}
              tally={tally}
              highlight={isRevealed}
              myVote={myVote}
            />
          </section>
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

function TallyBars({
  choices,
  tally,
  highlight,
  myVote,
}: {
  choices: StrawPollConfig["choices"];
  tally: Tally;
  highlight: boolean;
  myVote?: string | undefined;
}) {
  const total = Math.max(1, tally.total);
  return (
    <ol className="kukui-sp-live__bars">
      {choices.map((choice, idx) => {
        const count = tally.counts[choice.id] ?? 0;
        const pct = (count / total) * 100;
        const isMine = myVote === choice.id;
        return (
          <li key={choice.id} className="kukui-sp-live__bar-row">
            <span className="kukui-sp-live__bar-letter" aria-hidden="true">
              {String.fromCharCode(65 + idx)}
            </span>
            <div className="kukui-sp-live__bar-body">
              <div className="kukui-sp-live__bar-label">
                <span>{choice.label}</span>
                {isMine ? (
                  <span className="kukui-sp-live__bar-yours" aria-label="Your vote">
                    you
                  </span>
                ) : null}
              </div>
              <div
                className={[
                  "kukui-sp-live__bar-track",
                  highlight ? "is-revealed" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className="kukui-sp-live__bar-fill"
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
            <span className="kukui-sp-live__bar-count">
              {count}
              <span className="kukui-sp-live__bar-pct"> · {Math.round(pct)}%</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export const liveActivity: LiveActivityManifest<"straw-poll"> = {
  kind: "straw-poll",
  Component: StrawPollLive as ComponentType<LiveActivityProps>,
};
