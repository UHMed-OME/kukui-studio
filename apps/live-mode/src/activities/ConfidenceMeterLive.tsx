import { useMemo, useState, type ComponentType } from "react";
import type { LiveRoomHandle, Presence } from "@kukui/live";
import type { LiveActivityManifest, LiveActivityProps } from "./types.js";
import type { ConfidenceMeterConfig } from "@kukui/schemas";
import { usePhase } from "../usePhase.js";
import { useConfidenceMeter, type RatingSnapshot } from "./useConfidenceMeter.js";
import "./LiveCommon.css";

export type ConfidenceMeterLiveProps = {
  room: LiveRoomHandle;
  presence: Map<string, Presence>;
  role: "instructor" | "student";
  config: ConfidenceMeterConfig;
  onLeave: () => void;
};

/**
 * Live runtime for the Confidence Meter. Students each drag a 0..100
 * slider; instructor sees a histogram + mean. Same phase machinery as
 * Straw Poll (lobby → question → reveal → discussion → ended): rating
 * opens during "question", final histogram visible at "reveal+".
 */
export function ConfidenceMeterLive({
  room,
  presence,
  role,
  config,
  onLeave,
}: ConfidenceMeterLiveProps) {
  const { phase, setPhase } = usePhase(room, role);
  const { snapshot, rate, clearAll } = useConfidenceMeter(room, role);

  const behaviour = config.behaviour ?? {};
  const showLive = behaviour.showLiveResultsToStudents !== false;
  const allowChange = behaviour.allowChangeRating !== false;

  const isOpen = phase === "question";
  const isRevealed =
    phase === "reveal" || phase === "discussion" || phase === "ended";

  const scale = config.scale ?? { min: 0, max: 100, step: 1 };

  if (role === "instructor") {
    const studentCount = [...presence.values()].filter((p) => p.role === "student").length;
    const reset = () => {
      if (!window.confirm("Reset and clear all ratings? This can't be undone.")) return;
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
            {snapshot.values.length} rating{snapshot.values.length === 1 ? "" : "s"} in
          </p>
          <section className="kukui-live-prompt">
            <p>{config.prompt}</p>
          </section>
          <Histogram snapshot={snapshot} scale={scale} highlight={isRevealed} />
          <div className="kukui-live-controls" aria-label="Confidence meter controls">
            {phase === "lobby" ? (
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={() => setPhase("question")}
              >
                Open rating
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

  const studentSeesResults = isRevealed || (showLive && snapshot.myRating !== undefined);
  const hasRated = snapshot.myRating !== undefined;
  const canRate = isOpen && (allowChange || !hasRated);
  const sliderValue =
    snapshot.myRating ?? Math.round((scale.min + scale.max) / 2);

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
            Waiting for the instructor to open the rating…
          </div>
        ) : null}
        {isOpen ? (
          <div className="kukui-cm__slider-wrap">
            <div className="kukui-cm__slider-row">
              <span className="kukui-cm__slider-end">
                {scale.lowLabel ?? scale.min}
                {scale.unit ?? ""}
              </span>
              <input
                type="range"
                min={scale.min}
                max={scale.max}
                step={scale.step ?? 1}
                value={sliderValue}
                disabled={!canRate}
                onChange={(e) => rate(Number(e.target.value))}
                className="kukui-cm__slider"
                aria-label={`Your rating from ${scale.min} to ${scale.max}`}
              />
              <span className="kukui-cm__slider-end">
                {scale.highLabel ?? scale.max}
                {scale.unit ?? ""}
              </span>
            </div>
            <div className="kukui-cm__slider-value" aria-live="polite">
              {hasRated ? (
                <>
                  Your rating:{" "}
                  <strong>
                    {snapshot.myRating}
                    {scale.unit ?? ""}
                  </strong>{" "}
                  (saved)
                </>
              ) : (
                <span style={{ color: "var(--color-text-secondary)" }}>
                  Drag the slider to set your rating
                </span>
              )}
            </div>
          </div>
        ) : null}
        {studentSeesResults ? (
          <Histogram snapshot={snapshot} scale={scale} highlight={isRevealed} />
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

function Histogram({
  snapshot,
  scale,
  highlight,
}: {
  snapshot: RatingSnapshot;
  scale: { min: number; max: number; step?: number; unit?: string };
  highlight: boolean;
}) {
  // 10 bins across the scale.
  const bins = useMemo(() => {
    const count = 10;
    const range = scale.max - scale.min;
    const width = range / count;
    const out = Array<number>(count).fill(0);
    for (const v of snapshot.values) {
      // Guard a degenerate scale (min === max → width 0 → NaN index): drop
      // everything into the first bin instead of producing NaN.
      const idx =
        width > 0
          ? Math.min(count - 1, Math.max(0, Math.floor((v - scale.min) / width)))
          : 0;
      out[idx] = (out[idx] ?? 0) + 1;
    }
    return out;
  }, [snapshot.values, scale.min, scale.max]);
  const maxBin = Math.max(1, ...bins);

  return (
    <section className="kukui-cm__hist" aria-label="Rating distribution">
      <header className="kukui-cm__hist-head">
        <span>Distribution</span>
        <span>
          n = {snapshot.values.length} · mean ={" "}
          {snapshot.values.length === 0 ? "—" : snapshot.mean.toFixed(1)}
          {scale.unit ?? ""}
        </span>
      </header>
      <div className="kukui-cm__hist-bars">
        {bins.map((count, i) => {
          const height = (count / maxBin) * 100;
          return (
            <div key={i} className="kukui-cm__hist-col" aria-hidden="true">
              <div
                className={[
                  "kukui-cm__hist-bar",
                  highlight ? "is-revealed" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ height: `${Math.max(2, height)}%` }}
                title={`${count} rating${count === 1 ? "" : "s"}`}
              />
            </div>
          );
        })}
      </div>
      <div className="kukui-cm__hist-axis" aria-hidden="true">
        <span>{scale.min}</span>
        <span>{scale.max}</span>
      </div>
    </section>
  );
}

export const liveActivity: LiveActivityManifest<"confidence-meter"> = {
  kind: "confidence-meter",
  Component: ConfidenceMeterLive as ComponentType<LiveActivityProps>,
};
