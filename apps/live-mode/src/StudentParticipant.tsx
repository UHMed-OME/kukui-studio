import type { LiveRoomHandle, LivePhase, Presence } from "@kukui/live";
import { usePhase } from "./usePhase.js";

const PHASE_LABELS: Record<LivePhase, string> = {
  lobby: "Waiting in lobby",
  question: "Question in progress",
  reveal: "Revealing answers",
  discussion: "Discussion",
  ended: "Activity ended",
};

const PHASE_DESCRIPTIONS: Record<LivePhase, string> = {
  lobby: "The instructor will start the activity shortly.",
  question: "Answer the prompt your instructor presents.",
  reveal: "The instructor is revealing the correct answers.",
  discussion: "Discuss with your group while the instructor moderates.",
  ended: "Thanks for participating — you can safely close this tab.",
};

export type StudentParticipantProps = {
  room: LiveRoomHandle;
  presence: Map<string, Presence>;
  activityKind: string;
  configTitle: string | undefined;
  onLeave: () => void;
};

/**
 * Read-only view of the room from a student's perspective. No phase
 * controls — the instructor drives the experience. Activity-specific
 * surfaces (TBL, Poll, Timeline) land in M2+.
 */
export function StudentParticipant({
  room,
  presence,
  activityKind,
  configTitle,
  onLeave,
}: StudentParticipantProps) {
  const { phase } = usePhase(room);

  return (
    <div className="live-shell">
      <article className="live-card" aria-label="Student participant">
        <div className="live-brand">
          <img className="live-logo" src="/kukui-logo.svg" alt="" aria-hidden="true" />
          <h1 className="live-title">{configTitle ?? "Live session"}</h1>
        </div>
        <p className="live-subtitle">
          Room <code>{room.code.slice(0, 8)}…</code>
        </p>

        <div
          className="live-banner"
          role="status"
          aria-live="polite"
          data-testid="phase-banner"
        >
          <strong data-testid="phase-label">{PHASE_LABELS[phase]}</strong>
          <p style={{ margin: "4px 0 0", fontSize: 13 }}>{PHASE_DESCRIPTIONS[phase]}</p>
        </div>

        <section aria-labelledby="student-presence-heading" style={{ marginTop: 24 }}>
          <h2
            id="student-presence-heading"
            style={{
              margin: "0 0 12px",
              fontSize: "var(--font-size-prompt, 16px)",
              fontWeight: 700,
            }}
          >
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
          </div>
        </section>

        <p
          style={{
            marginTop: 16,
            fontSize: 12,
            color: "var(--color-text-secondary)",
          }}
        >
          Activity kind: <code>{activityKind}</code>
        </p>

        <div className="live-actions" style={{ marginTop: 24 }}>
          <button type="button" className="live-btn live-btn--ghost" onClick={onLeave}>
            Leave room
          </button>
        </div>
      </article>
    </div>
  );
}
