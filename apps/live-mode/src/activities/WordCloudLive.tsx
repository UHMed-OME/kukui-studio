import { useMemo, useState } from "react";
import type { LiveRoomHandle, Presence } from "@kukui/live";
import type { WordCloudConfig } from "@kukui/schemas";
import { usePhase } from "../usePhase.js";
import { useWordCloud, type WordTally } from "./useWordCloud.js";
import "./LiveCommon.css";

export type WordCloudLiveProps = {
  room: LiveRoomHandle;
  presence: Map<string, Presence>;
  role: "instructor" | "student";
  config: WordCloudConfig;
  onLeave: () => void;
};

export function WordCloudLive({
  room,
  presence,
  role,
  config,
  onLeave,
}: WordCloudLiveProps) {
  const { phase, setPhase } = usePhase(room);
  const behaviour = config.behaviour ?? {};
  const caseSensitive = behaviour.caseSensitive === true;
  const showLive = behaviour.showLiveResultsToStudents !== false;
  const maxSubmissions = config.submissionsPerStudent ?? 1;
  const maxWords = config.maxWordsPerSubmission ?? 2;
  const maxChars = config.maxCharsPerSubmission ?? 24;

  const { snapshot, submit, remove, clearAll } = useWordCloud(room, caseSensitive);
  const [draft, setDraft] = useState("");

  const isOpen = phase === "question";
  const isRevealed =
    phase === "reveal" || phase === "discussion" || phase === "ended";
  const studentSeesCloud =
    isRevealed || (showLive && snapshot.mySubmissions.length > 0);

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed.length > maxChars) return;
    if (trimmed.split(/\s+/).length > maxWords) return;
    if (snapshot.mySubmissions.length >= maxSubmissions) return;
    submit(trimmed);
    setDraft("");
  };

  if (role === "instructor") {
    const studentCount = [...presence.values()].filter((p) => p.role === "student").length;
    const reset = () => {
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
            {snapshot.total} submission{snapshot.total === 1 ? "" : "s"}
          </p>
          <section className="kukui-live-prompt">
            <p>{config.prompt}</p>
          </section>
          <Cloud tally={snapshot.tally} total={snapshot.total} highlight={isRevealed} />
          <div className="kukui-live-controls" aria-label="Word cloud controls">
            {phase === "lobby" ? (
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={() => setPhase("question")}
              >
                Open submissions
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

  const remaining = maxSubmissions - snapshot.mySubmissions.length;
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
            Waiting for the instructor to open submissions…
          </div>
        ) : null}
        {isOpen ? (
          <>
            <div className="kukui-wc__input-row">
              <input
                type="text"
                className="kukui-wc__input"
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, maxChars))}
                placeholder={`Up to ${maxWords} word${maxWords === 1 ? "" : "s"}, ${maxChars} chars`}
                disabled={remaining <= 0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                aria-label="Your submission"
              />
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={handleSubmit}
                disabled={remaining <= 0 || draft.trim().length === 0}
              >
                Submit
              </button>
            </div>
            <p style={{ fontSize: "var(--font-size-meta, 13px)", color: "var(--color-text-secondary)" }}>
              {remaining} submission{remaining === 1 ? "" : "s"} remaining
            </p>
            {snapshot.mySubmissions.length > 0 ? (
              <div className="kukui-wc__submissions" aria-label="Your submissions">
                {snapshot.mySubmissions.map((s, i) => (
                  <span key={`${s}-${i}`} className="kukui-wc__submission">
                    {s}
                    <button
                      type="button"
                      className="kukui-wc__submission-remove"
                      onClick={() => remove(s)}
                      aria-label={`Remove ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        {studentSeesCloud ? (
          <Cloud tally={snapshot.tally} total={snapshot.total} highlight={isRevealed} />
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

function Cloud({
  tally,
  total,
  highlight,
}: {
  tally: WordTally;
  total: number;
  highlight: boolean;
}) {
  const sorted = useMemo(() => {
    return [...tally.entries()]
      .map(([key, slot]) => ({ key, ...slot }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 60);
  }, [tally]);
  const maxCount = Math.max(1, ...sorted.map((s) => s.count));

  if (sorted.length === 0) {
    return (
      <div className="kukui-wc__cloud" role="status">
        <span style={{ color: "var(--color-text-secondary)" }}>
          No submissions yet.
        </span>
      </div>
    );
  }

  return (
    <div className="kukui-wc__cloud" role="img" aria-label={`Word cloud, ${total} submissions`}>
      {sorted.map(({ key, count, rawSamples }) => {
        // Font size scales 14–48 px by frequency.
        const fontSize = 14 + Math.round((count / maxCount) * 34);
        const display = rawSamples[0] ?? key;
        return (
          <span
            key={key}
            className="kukui-wc__word"
            style={{
              fontSize,
              color: highlight ? "var(--color-accent, #b69b5d)" : undefined,
            }}
            title={`${count} mention${count === 1 ? "" : "s"}`}
          >
            {display}
            <span className="kukui-wc__word-count">×{count}</span>
          </span>
        );
      })}
    </div>
  );
}
