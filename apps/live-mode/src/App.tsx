import { useEffect, useRef, useState } from "react";
import {
  joinLiveRoom,
  deriveRoomCode,
  SIGNALING_BACKENDS,
  SIGNALING_BACKEND_LABELS,
  type LiveRoomHandle,
  type SignalingBackend,
} from "@kukui/live";
import type { Presence } from "@kukui/live";
import type { ActivityKind } from "@kukui/core";
import { LiveHost } from "./LiveHost.js";

const SIGNALING_STORAGE_KEY = "kukui-live:signaling-backend";

/**
 * Footer rendered under every live screen: who made this (a link to
 * Kukui Studio so curious learners + instructors can author their
 * own) and which build is deployed (CI sets `VITE_KUKUI_VERSION` to
 * the commit SHA so support reports include the exact build).
 *
 * The Studio URL is taken from `VITE_KUKUI_STUDIO_URL` if set,
 * otherwise defaults to the prod domain. Override in your fork.
 */
function AttributionFooter() {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  const studioUrl = env.VITE_KUKUI_STUDIO_URL ?? "https://kukuistudio.com";
  const version = env.VITE_KUKUI_VERSION ?? "dev";
  const shortVersion =
    version.length > 7 && /^[0-9a-f]+$/i.test(version) ? version.slice(0, 7) : version;
  return (
    <footer className="live-attrib" aria-label="Build info">
      <span>
        Authored with{" "}
        <a href={studioUrl} target="_blank" rel="noopener noreferrer">
          Kukui Studio
        </a>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        Build <code>{shortVersion}</code>
      </span>
    </footer>
  );
}

function readBackendPreference(): SignalingBackend {
  if (typeof window === "undefined") return "nostr";
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("signal");
  if (fromUrl && (SIGNALING_BACKENDS as readonly string[]).includes(fromUrl)) {
    return fromUrl as SignalingBackend;
  }
  try {
    const stored = window.localStorage.getItem(SIGNALING_STORAGE_KEY);
    if (stored && (SIGNALING_BACKENDS as readonly string[]).includes(stored)) {
      return stored as SignalingBackend;
    }
  } catch {
    /* localStorage might be unavailable (private mode, SCORM sandboxes) */
  }
  return "nostr";
}

/** Reverse of Studio's base64url encoder — see Preview.tsx. */
function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Studio's "Open in Kukui Live" button packs the draft JSON into a
 * base64url URL param so the live app can preload it without a sample
 * fetch. Returns the parsed object on success, null otherwise.
 */
function readPreloadedConfig(): unknown | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("config");
  if (!raw) return null;
  try {
    return JSON.parse(fromBase64Url(raw));
  } catch {
    return null;
  }
}

type PreloadedConfigLive = {
  signaling?: SignalingBackend;
  relayUrls?: string[];
};

/**
 * Generate a per-session anonymous handle ("Guest-A37"). Used as the
 * display name in presence broadcasts so a real student name never
 * touches the federated Nostr / MQTT relay, which is observable to any
 * peer watching the same room hash. Letter + 2-digit suffix gives
 * 2,600 distinct handles — well above any realistic classroom size, so
 * collisions inside a single room are vanishingly rare.
 */
function pickAnonymousHandle(): string {
  const letter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(Math.floor(Math.random() * 26));
  const suffix = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return `Guest-${letter}${suffix}`;
}

function readConfigSignaling(config: unknown): PreloadedConfigLive | null {
  if (!config || typeof config !== "object") return null;
  const live = (config as Record<string, unknown>).live;
  if (!live || typeof live !== "object") return null;
  const out: PreloadedConfigLive = {};
  const sig = (live as Record<string, unknown>).signaling;
  if (sig === "nostr" || sig === "mqtt") out.signaling = sig;
  const urls = (live as Record<string, unknown>).relayUrls;
  if (Array.isArray(urls) && urls.every((u) => typeof u === "string")) {
    out.relayUrls = urls as string[];
  }
  return out;
}

/**
 * Activity kinds that have a real Live runtime today. Anything not in
 * this list falls through to the generic InstructorConsole /
 * StudentParticipant shell, which is fine for diagnostics but isn't a
 * usable activity. Adding a new live activity = add it here + add a
 * dispatch branch in LiveHost.
 */
const LIVE_ACTIVITIES: { kind: ActivityKind; label: string; sampleUrl: string }[] = [
  { kind: "straw-poll", label: "Straw Poll", sampleUrl: "/samples/straw-poll/basic.json" },
  {
    kind: "confidence-meter",
    label: "Confidence Meter",
    sampleUrl: "/samples/confidence-meter/basic.json",
  },
  {
    kind: "word-cloud",
    label: "Word Cloud",
    sampleUrl: "/samples/word-cloud/basic.json",
  },
  { kind: "qa-board", label: "Q&A Board", sampleUrl: "/samples/qa-board/basic.json" },
  { kind: "quick-quiz", label: "Quick Quiz", sampleUrl: "/samples/quick-quiz/basic.json" },
  // Pixel Chat (isometric-chatroom) — temporarily hidden from the Live
  // landing while the runtime is overhauled. Studio authoring still works.
  {
    kind: "multiple-choice",
    label: "Multiple Choice (demo shell)",
    sampleUrl: "/samples/multiple-choice/basic.json",
  },
];

const LIVE_AUTO_LOAD_KINDS = new Set<ActivityKind>([
  "straw-poll",
  "confidence-meter",
  "word-cloud",
  "qa-board",
  "quick-quiz",
]);

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
  const [role, setRole] = useState<"instructor" | "student">("student");
  const [signalingBackend, setSignalingBackend] = useState<SignalingBackend>(
    () => readBackendPreference(),
  );
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
  const [preloadedConfig, setPreloadedConfig] = useState<unknown | null>(() =>
    readPreloadedConfig(),
  );
  // The URL's adminKey is the canonical "you are the host" proof when
  // Studio launches the instructor view. The lobby still falls back to
  // the manual role picker for non-preloaded sessions (legacy flow,
  // local dev convenience).
  const adminKeyFromUrl = useRef<string | null>(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("adminKey")
      : null,
  );
  const subscribed = useRef(false);

  const join = async () => {
    setError(null);
    // Identity is anonymous-by-design. The federated relay (Nostr / MQTT
    // public broker) is observable to any peer watching the same room
    // hash, so we never transmit a real name. Each session gets a fresh
    // anonymous handle like "Guest-A37" — distinct enough for the
    // instructor's presence list, opaque to bystanders. If the engine
    // ever runs inside a SCORM iframe we'd swap to the LMS-side
    // identifier through a different code path; the relay still wouldn't
    // see it.
    const effectiveName = pickAnonymousHandle();

    // Two code paths depending on whether the URL preloaded a config:
    //   1. preloaded — room is derived from `config.live.joinKey`,
    //      signaling/relays from `config.live`, role from the URL's
    //      `?adminKey=` match. The user never types a room code.
    //   2. manual lobby — original M1 flow: user types 6-digit code,
    //      picks activity from dropdown, sample fixture is loaded.
    try {
      let roomCode: string;
      let effectiveRole: "instructor" | "student" = role;
      let effectiveBackend: SignalingBackend = signalingBackend;
      let effectiveRelays: string[] | undefined;
      let activityForConfig: ActivityKind = activityKind;

      if (preloadedConfig) {
        const cfg = preloadedConfig as Record<string, unknown>;
        const live = (cfg.live ?? {}) as Record<string, unknown>;
        const joinKey =
          typeof live.joinKey === "string" && live.joinKey.length > 0
            ? live.joinKey
            : (typeof cfg.title === "string" ? cfg.title : "kukui-live-default");
        roomCode = await deriveRoomCode(joinKey);
        if (live.signaling === "nostr" || live.signaling === "mqtt") {
          effectiveBackend = live.signaling;
        }
        if (Array.isArray(live.relayUrls)) {
          effectiveRelays = live.relayUrls.filter(
            (u): u is string => typeof u === "string",
          );
        }
        const sentAdmin = adminKeyFromUrl.current;
        const expectedAdmin =
          typeof live.adminKey === "string" ? live.adminKey : undefined;
        effectiveRole =
          expectedAdmin && sentAdmin && sentAdmin === expectedAdmin
            ? "instructor"
            : "student";
        activityForConfig = (typeof cfg.kind === "string"
          ? cfg.kind
          : activityKind) as ActivityKind;
      } else {
        if (!/^\d{6}$/.test(code.trim())) {
          setError("Room code must be 6 digits.");
          return;
        }
        roomCode = await deriveRoomCode(code.trim());
      }

      const handle = joinLiveRoom(roomCode, {
        appId: "kukui-live",
        backend: effectiveBackend,
        ...(effectiveRelays ? { relayUrls: effectiveRelays } : {}),
      });

      try {
        window.localStorage.setItem(SIGNALING_STORAGE_KEY, effectiveBackend);
      } catch {
        /* private mode / SCORM sandbox — non-fatal */
      }

      handle.setPresence({ name: effectiveName, role: effectiveRole });
      setRoom(handle);
      setRole(effectiveRole);
      setActivityKind(activityForConfig);

      // Provide the activity config to LiveHost. For the manual lobby
      // we point at the sample fixture; for the preloaded path we
      // skip the network fetch and stash the parsed object behind a
      // synthetic data URL.
      if (preloadedConfig) {
        const blob = new Blob([JSON.stringify(preloadedConfig)], {
          type: "application/json",
        });
        setConfigUrl(URL.createObjectURL(blob));
      } else {
        const sample = LIVE_ACTIVITIES.find((a) => a.kind === activityKind);
        if (sample && LIVE_AUTO_LOAD_KINDS.has(activityKind)) {
          setConfigUrl(sample.sampleUrl);
        }
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
      <>
        <LiveHost
          kind={activityKind}
          configUrl={configUrl}
          room={room}
          presence={presence}
          role={role}
          onLoadDemo={() => setConfigUrl(sample)}
          onLeave={handleLeave}
        />
        <AttributionFooter />
      </>
    );
  }

  // The preload path (Studio's "Launch in Live" buttons + future
  // SCO-embed) skips the room-code / activity / signaling pickers
  // since those are dictated by the URL's `?config=` payload. Render
  // a slim lobby that only asks for the display name and shows the
  // author's title so the joiner knows what they're entering.
  const previewTitle =
    preloadedConfig && typeof preloadedConfig === "object"
      ? (preloadedConfig as Record<string, unknown>).title
      : undefined;
  const previewRole: "instructor" | "student" = (() => {
    if (!preloadedConfig) return role;
    const live = (preloadedConfig as Record<string, unknown>).live as
      | Record<string, unknown>
      | undefined;
    const expected = typeof live?.adminKey === "string" ? live.adminKey : undefined;
    return expected && adminKeyFromUrl.current === expected
      ? "instructor"
      : "student";
  })();

  if (preloadedConfig) {
    return (
      <div className="live-shell">
        <article className="live-card">
          <div className="live-brand">
            <img className="live-logo" src="/kukui-logo.svg" alt="" aria-hidden="true" />
            <h1 className="live-title">
              {typeof previewTitle === "string" ? previewTitle : "Kukui Live session"}
            </h1>
          </div>
          <p className="live-subtitle">
            Joining as <strong>{previewRole}</strong> with an anonymous handle. Room derived
            from the activity's join key — no code to type.
          </p>
          {error ? (
            <p
              role="alert"
              style={{ color: "var(--color-error)", fontSize: 13, marginBottom: 16 }}
            >
              {error}
            </p>
          ) : null}
          <div className="live-actions">
            <button
              type="button"
              className="live-btn live-btn--primary"
              onClick={join}
            >
              Join {previewRole === "instructor" ? "as instructor" : "as student"}
            </button>
            <button
              type="button"
              className="live-btn live-btn--ghost"
              onClick={() => {
                // Drop the preload and fall through to the manual lobby
                // — escape hatch if the URL looks suspicious.
                setPreloadedConfig(null);
                adminKeyFromUrl.current = null;
              }}
            >
              Use manual lobby instead
            </button>
          </div>
        </article>
      </div>
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
        <details className="live-field" style={{ marginBottom: 16 }}>
          <summary
            style={{
              fontSize: 13,
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            Advanced: signaling backend
          </summary>
          <div style={{ marginTop: 8 }}>
            <label htmlFor="signal" style={{ fontSize: 13 }}>
              How peers find each other (data still flows P2P regardless)
            </label>
            <select
              id="signal"
              value={signalingBackend}
              onChange={(e) => setSignalingBackend(e.target.value as SignalingBackend)}
              style={{
                marginTop: 4,
                minHeight: 44,
                padding: "10px 12px",
                border: "2px solid var(--color-border)",
                borderRadius: 8,
                width: "100%",
              }}
            >
              {SIGNALING_BACKENDS.map((b) => (
                <option key={b} value={b}>
                  {SIGNALING_BACKEND_LABELS[b]}
                </option>
              ))}
            </select>
          </div>
        </details>
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
        Peers discover each other via Nostr relays by default (MQTT brokers as an alternate —
        Advanced above). After signaling, data flows direct WebRTC P2P. Public STUN handles NAT
        traversal; <code>?turn=&lt;url&gt;</code> in the URL adds a TURN fallback when symmetric
        NATs block STUN.
      </p>
    </div>
  );
}

