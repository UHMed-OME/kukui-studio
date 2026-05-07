import { useEffect, useRef, useState } from "react";
import { joinLiveRoom, deriveRoomCode, getRoomState, type LiveRoomHandle } from "@kukui/live";
import type { Presence } from "@kukui/live";
import { ThemeToggle } from "@kukui/core";

/**
 * Kukui Live — M0 lobby shell.
 *
 * Phase 3 starting point. The full Live activity catalog (TBL Round, Live
 * Poll, Live Timeline) lands later — this v0 establishes the join flow,
 * the Trystero+Y.js mesh handshake, and the presence list. From here,
 * each Live activity component plugs into the existing room handle and
 * runs against the same Y.Doc.
 */
export function App() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"instructor" | "student">("student");
  const [room, setRoom] = useState<LiveRoomHandle | null>(null);
  const [presence, setPresence] = useState<Map<string, Presence>>(new Map());
  const [error, setError] = useState<string | null>(null);
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

  if (room) {
    return (
      <Lobby
        room={room}
        presence={presence}
        onLeave={() => {
          room.leave();
          setRoom(null);
          setPresence(new Map());
          subscribed.current = false;
        }}
      />
    );
  }

  return (
    <div className="live-shell">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <ThemeToggle />
      </div>
      <article className="live-card">
        <h1 className="live-title">Kukui Live</h1>
        <p className="live-subtitle">
          Real-time classroom activities — peer-to-peer, no UH-operated server. M0 transport
          + presence shell. Activity catalog lands in M2+.
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

function Lobby({
  room,
  presence,
  onLeave,
}: {
  room: LiveRoomHandle;
  presence: Map<string, Presence>;
  onLeave: () => void;
}) {
  const state = getRoomState(room);
  const phase = state.getPhase();

  return (
    <div className="live-shell">
      <article className="live-card">
        <h1 className="live-title">Lobby</h1>
        <p className="live-subtitle">
          Connected to room <code>{room.code.slice(0, 8)}…</code> · phase: <strong>{phase}</strong>
        </p>
        <div className="live-banner">
          <strong>{presence.size}</strong> participant{presence.size === 1 ? "" : "s"} in the
          room.
        </div>
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
        <div className="live-actions" style={{ marginTop: 24 }}>
          <button type="button" className="live-btn live-btn--ghost" onClick={onLeave}>
            Leave room
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
        Activity catalog lands in M2 (TBL Round, Live Poll, Live Timeline). For now this is a
        bare lobby that proves the mesh handshake + presence sync.
      </p>
    </div>
  );
}
