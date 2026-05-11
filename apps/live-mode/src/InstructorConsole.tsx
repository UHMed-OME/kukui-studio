import { useState } from "react";
import type { LiveRoomHandle, LivePhase, Presence } from "@kukui/live";
import { usePhase } from "./usePhase.js";

const PHASE_ORDER: readonly LivePhase[] = [
  "lobby",
  "question",
  "reveal",
  "discussion",
  "ended",
];

const PHASE_LABELS: Record<LivePhase, string> = {
  lobby: "Lobby",
  question: "Question",
  reveal: "Reveal",
  discussion: "Discussion",
  ended: "Ended",
};

export type InstructorConsoleProps = {
  room: LiveRoomHandle;
  presence: Map<string, Presence>;
  activityKind: string;
  configSummary: ConfigSummary;
  onLoadDemo: () => void;
  hasDemoLoaded: boolean;
  onLeave: () => void;
};

export type ConfigSummary = {
  title?: string;
  version?: string;
  detail?: string;
};

/**
 * Instructor-only view. Owns phase progression, presence inspection, and
 * "Reset" to lobby. All phase mutations go through `usePhase`, which writes
 * to the shared Y.Doc — students see the change immediately.
 *
 * For M1 this is the *shell*: there is no activity rendering, no aggregate
 * visualization. Those land in M2 (TBL), M3 (Live Poll), M4 (Timeline).
 */
export function InstructorConsole({
  room,
  presence,
  activityKind,
  configSummary,
  onLoadDemo,
  hasDemoLoaded,
  onLeave,
}: InstructorConsoleProps) {
  const { phase, setPhase } = usePhase(room);
  const [confirmReset, setConfirmReset] = useState(false);

  const currentIndex = PHASE_ORDER.indexOf(phase);
  const nextPhase = currentIndex >= 0 ? PHASE_ORDER[currentIndex + 1] : undefined;

  const advance = () => {
    if (nextPhase) setPhase(nextPhase);
  };

  const reset = () => {
    setPhase("lobby");
    setConfirmReset(false);
  };

  return (
    <div className="live-shell">
      <article className="live-card" aria-label="Instructor console">
        <div className="live-brand">
          <img className="live-logo" src="/kukui-logo.svg" alt="" aria-hidden="true" />
          <h1 className="live-title">Instructor console</h1>
        </div>
        <p className="live-subtitle">
          Room <code>{room.code.slice(0, 8)}…</code> · phase:{" "}
          <strong data-testid="phase-label">{PHASE_LABELS[phase]}</strong>
        </p>

        <section aria-labelledby="activity-heading" className="live-section">
          <h2 id="activity-heading" className="live-section__heading">
            Activity
          </h2>
          {hasDemoLoaded ? (
            <div className="live-banner" data-testid="activity-summary">
              <div>
                <strong>{configSummary.title ?? "(untitled)"}</strong> · kind:{" "}
                <code>{activityKind}</code>
                {configSummary.version ? ` · v${configSummary.version}` : ""}
              </div>
              {configSummary.detail ? (
                <div style={{ marginTop: 4, fontSize: 12 }}>{configSummary.detail}</div>
              ) : null}
            </div>
          ) : (
            <div className="live-banner">
              <p style={{ margin: 0 }}>
                No activity loaded yet. Load the demo Multiple Choice to verify the host
                pipeline.
              </p>
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="live-btn live-btn--primary"
                  onClick={onLoadDemo}
                >
                  Load demo activity
                </button>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="phase-heading" className="live-section">
          <h2 id="phase-heading" className="live-section__heading">
            Phase progression
          </h2>
          <ol className="live-phase-track" aria-label="Phase progression">
            {PHASE_ORDER.map((p, i) => {
              const isCurrent = p === phase;
              const isPast = i < currentIndex;
              const chipClass = [
                "live-phase-chip",
                isCurrent ? "live-phase-chip--current" : "",
                isPast ? "live-phase-chip--past" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <li
                  key={p}
                  aria-current={isCurrent ? "step" : undefined}
                  className={chipClass}
                >
                  {PHASE_LABELS[p]}
                </li>
              );
            })}
          </ol>
          <div className="live-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="live-btn live-btn--primary"
              onClick={advance}
              disabled={!nextPhase}
              aria-label={
                nextPhase ? `Advance to ${PHASE_LABELS[nextPhase]}` : "Activity ended"
              }
            >
              {nextPhase ? `Advance to ${PHASE_LABELS[nextPhase]}` : "Activity ended"}
            </button>
            {confirmReset ? (
              <>
                <button
                  type="button"
                  className="live-btn live-btn--primary"
                  onClick={reset}
                >
                  Confirm reset
                </button>
                <button
                  type="button"
                  className="live-btn live-btn--ghost"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="live-btn live-btn--ghost"
                onClick={() => setConfirmReset(true)}
              >
                Reset to lobby
              </button>
            )}
          </div>
        </section>

        <section aria-labelledby="presence-heading" className="live-section">
          <h2 id="presence-heading" className="live-section__heading">
            Participants ({presence.size})
          </h2>
          <div className="live-presence">
            {[...presence.values()].map((p) => (
              <span
                key={p.id}
                className={[
                  "live-presence__chip",
                  p.role === "instructor" ? "live-presence__chip--instructor" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {p.name} {p.role === "instructor" ? "(instructor)" : ""}
              </span>
            ))}
            {presence.size === 0 ? (
              <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                Waiting for participants…
              </span>
            ) : null}
          </div>
        </section>

        <div className="live-actions" style={{ marginTop: 24 }}>
          <button type="button" className="live-btn live-btn--ghost" onClick={onLeave}>
            Leave room
          </button>
        </div>
      </article>
    </div>
  );
}

