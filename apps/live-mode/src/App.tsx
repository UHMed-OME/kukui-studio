import { useEffect, useRef, useState } from "react";
import { joinLiveRoom, deriveRoomCode, type LiveRoomHandle } from "@kukui/live";
import type { Presence } from "@kukui/live";
import type { ActivityKind } from "@kukui/core";
import { LiveHost } from "./LiveHost.js";

/**
 * Activity kinds that have a real Live runtime today. Anything not in
 * this list falls through to the generic InstructorConsole /
 * StudentParticipant shell, which is fine for diagnostics but isn't a
 * usable activity. Adding a new live activity = add it here + add a
 * dispatch branch in LiveHost.
 */
const LIVE_ACTIVITIES: { kind: ActivityKind; label: string; sampleUrl: string }[] = [
  {
    kind: "straw-poll",
    label: "Straw Poll",
    sampleUrl: "/samples/straw-poll/basic.json",
  },
  {
    kind: "multiple-choice",
    label: "Multiple Choice (demo shell)",
    sampleUrl: "/samples/multiple-choice/basic.json",
  },
];

/**
 * Kukui Live — M1 shell.
 *
 * The M0 lobby (join flow + presence) lives here unchanged. Once a room
 * handle exists, we delegate to LiveHost which validates an activity JSON
 * config and routes to InstructorConsole or StudentParticipant by role.
 *
 * The activity catalog (TBL Round in M2, Live Poll in M3, Live Timeline in
 * M4) plugs in via LiveHost as those land.
 */
export function App() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"instructor" | "student">("student");
  // The activity choice doubles as both "what kind to host" and "what
  // sample to auto-load". URL ?activity=<kind> is honoured so an
  // instructor can paste a deeplink that already names the activity.
  const [activityKind, setActivityKind] = useState<ActivityKind>(() => {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    const fromUrl = params.get("activity");
    return (LIVE_ACTIVITIES.find((a) => a.kind === fromUrl)?.kind ??
      LIVE_ACTIVITIES[0]?.kind ??
      "straw-poll") as ActivityKind;
  });
  const [room, setRoom] = useState<LiveRoomHandle | null>(null);
  const [presence, setPresence] = useState<Map<string, Presence>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [configUrl, setConfigUrl] = useState<string | undefined>(undefined);
  const subscribed = useRef(false);

  const join = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Room code must be 6 digits.");
      return;
    }
    if (name.trim().length === 0) {
      setError("Pick a display name first.");
      return;
    }
    try {
      const roomCode = await deriveRoomCode(code.trim());
      const handle = joinLiveRoom(roomCode, {
        appId: "kukui-live",
      });
      handle.setPresence({ name: name.trim(), role });
      setRoom(handle);
      // For the activities with a real Live runtime, auto-load the
      // sample so both instructor and students see the same JSON the
      // moment they enter the room. The shell activities (multiple-
      // choice diagnostic) still rely on the manual "Load demo" button.
      const sample = LIVE_ACTIVITIES.find((a) => a.kind === activityKind);
      if (sample && activityKind === "straw-poll") {
        setConfigUrl(sample.sampleUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join room.");
    }
  };

  // Subscribe to presence changes once a room is open.
  useEffect(() => {
    if (!room || subscribed.current) return;
    subscribed.current = true;
    const tick = () => setPresence(new Map(room.presence()));
    tick();
    const interval = window.setInterval(tick, 750);
    return () => {
      window.clearInterval(interval);
    };
  }, [room]);

  // Tear down the room when this component unmounts.
  useEffect(() => {
    return () => {
      if (room) room.leave();
    };
  }, [room]);

  const handleLeave = () => {
    if (room) room.leave();
    setRoom(null);
    setPresence(new Map());
    setConfigUrl(undefined);
    subscribed.current = false;
  };

  if (room) {
    const sample =
      LIVE_ACTIVITIES.find((a) => a.kind === activityKind)?.sampleUrl ??
      "/samples/multiple-choice/basic.json";
    return (
      <LiveHost
        kind={activityKind}
        configUrl={configUrl}
        room={room}
        presence={presence}
        role={role}
        onLoadDemo={() => setConfigUrl(sample)}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <div className="live-shell">
      <article className="live-card">
        <div className="live-brand">
          <img className="live-logo" src="/kukui-logo.svg" alt="" aria-hidden="true" />
          <h1 className="live-title">Kukui Live</h1>
        </div>
        <p className="live-subtitle">
          Real-time classroom activities — peer-to-peer, no UH-operated server. M1 lobby +
          host shell. Activity catalog lands in M2+.
        </p>
        <div className="live-field">
          <label htmlFor="code">Room code (6 digits)</label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
          />
        </div>
        <div className="live-field">
          <label htmlFor="name">Display name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (or a handle)"
            maxLength={40}
          />
        </div>
        <div className="live-field">
          <label htmlFor="role">Role</label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as "instructor" | "student")}
            style={{
              minHeight: 44,
              padding: "10px 12px",
              border: "2px solid var(--color-border)",
              borderRadius: 8,
            }}
          >
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
          </select>
        </div>
        <div className="live-field">
          <label htmlFor="activity">Activity</label>
          <select
            id="activity"
            value={activityKind}
            onChange={(e) => setActivityKind(e.target.value as ActivityKind)}
            style={{
              minHeight: 44,
              padding: "10px 12px",
              border: "2px solid var(--color-border)",
              borderRadius: 8,
            }}
          >
            {LIVE_ACTIVITIES.map((a) => (
              <option key={a.kind} value={a.kind}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <p
            role="alert"
            style={{
              color: "var(--color-error)",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </p>
        ) : null}
        <div className="live-actions">
          <button type="button" className="live-btn live-btn--primary" onClick={join}>
            Join room
          </button>
        </div>
      </article>
      <p
        style={{
          fontSize: 12,
          color: "var(--color-text-secondary)",
          textAlign: "center",
        }}
      >
        Public BitTorrent trackers signal the mesh. Public STUN handles NAT traversal.{" "}
        <code>?turn=&lt;url&gt;</code> in the URL adds a TURN fallback when symmetric NATs block
        STUN.
      </p>
    </div>
  );
}

