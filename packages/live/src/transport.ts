import { joinRoom as joinNostr } from "trystero/nostr";
import { joinRoom as joinMqtt } from "trystero/mqtt";
import type { Room as TrysteroRoom } from "trystero";
import * as Y from "yjs";
import type {
  ParticipantId,
  Presence,
  SignalingBackend,
  TransportOptions,
} from "./types.js";

/**
 * Trystero + Y.js transport wrapper.
 *
 * `joinLiveRoom(code, options)` opens a P2P mesh using the chosen
 * signaling backend (Nostr by default, MQTT as an alternate), then
 * establishes a Y.Doc shared across the mesh for CRDT-merged room
 * state. Public BitTorrent trackers (Trystero's default backend) are
 * deliberately *not* offered — they're commonly DPI-blocked on
 * institutional networks, which is exactly where Kukui Live needs to
 * work.
 *
 * Signaling backends:
 *   - **Nostr** (default): WebSocket relays from the Nostr ecosystem.
 *     Lightweight, federated, generally permitted on edu networks
 *     because it's not associated with file-sharing.
 *   - **MQTT**: public MQTT brokers. Use as a fallback if Nostr
 *     relays are blocked or flaky.
 *
 * Switching backends only changes how peers *find* each other. After
 * signaling, data flows direct WebRTC P2P regardless of backend — the
 * `LiveRoomHandle`, Y.Doc, presence model, and activity code don't
 * change.
 *
 * Mocked in tests via `__setRoomFactoryForTest`.
 */

export interface LiveRoomHandle {
  code: string;
  doc: Y.Doc;
  participantId: ParticipantId;
  /** Signaling backend that opened the mesh — handy for diagnostics / UI badges. */
  backend: SignalingBackend;
  setPresence(p: Omit<Presence, "id" | "joinedAt">): void;
  presence(): Map<ParticipantId, Presence>;
  onPeerJoin(cb: (id: ParticipantId) => void): () => void;
  onPeerLeave(cb: (id: ParticipantId) => void): () => void;
  leave(): void;
}

type RoomFactory = (
  code: string,
  options: TransportOptions,
  participantId: ParticipantId,
) => LiveRoomHandle;

let roomFactory: RoomFactory = realRoomFactory;

export function joinLiveRoom(
  code: string,
  options: TransportOptions = {},
  participantId?: ParticipantId,
): LiveRoomHandle {
  const id = participantId ?? generateParticipantId();
  return roomFactory(code, options, id);
}

/** Test seam: replace the room factory with a stub that doesn't open a real mesh. */
export function __setRoomFactoryForTest(factory: RoomFactory | null): void {
  roomFactory = factory ?? realRoomFactory;
}

type JoinFn = typeof joinNostr;

const JOIN_BY_BACKEND: Record<SignalingBackend, JoinFn> = {
  nostr: joinNostr,
  mqtt: joinMqtt,
};

/**
 * Curated default relay URLs.
 *
 * Why we don't fall through to Trystero's built-in defaults: several
 * public relays in the wild return HTTP 401 + `WWW-Authenticate:
 * Basic` (or another challenge that Chrome treats as a credential
 * request) during the WebSocket upgrade handshake. That triggers
 * Chrome's native sign-in / save-password dialog before the JS fetch
 * error path can catch it — there is no way to suppress those prompts
 * from page JavaScript. We explicitly avoid those relays.
 *
 * The list below is curated to relays that:
 *   1. Are publicly accessible (no auth challenge on /, no token gate)
 *   2. Have a track record of stability for browser WebSocket clients
 *   3. Don't slow-walk the upgrade with TLS shenanigans
 *
 * Kept deliberately *short* — just the most reliable public endpoints,
 * because every relay in this list is opened on page load and even one
 * misbehaving relay can prompt the user.
 *
 * Authors can still override via `options.relayUrls` for institutional
 * proxies. If everyone in a room agrees on the same custom list, the
 * mesh forms there instead.
 */
const DEFAULT_NOSTR_RELAYS: readonly string[] = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
];

const DEFAULT_MQTT_RELAYS: readonly string[] = [
  "wss://test.mosquitto.org:8081",
];

const DEFAULT_RELAYS_BY_BACKEND: Record<SignalingBackend, readonly string[]> = {
  nostr: DEFAULT_NOSTR_RELAYS,
  mqtt: DEFAULT_MQTT_RELAYS,
};

/**
 * Public STUN servers used for ICE candidate discovery. A short list of
 * well-known, free, no-auth Google STUN endpoints — enough redundancy
 * that one being unreachable doesn't block candidate gathering. STUN
 * only reveals a peer's public reflexive address; no media or data flows
 * through it, so there's no privacy cost to using public servers (unlike
 * TURN, which relays traffic and is therefore opt-in via `options.turn`).
 */
const DEFAULT_STUN_SERVERS: readonly RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function realRoomFactory(
  code: string,
  options: TransportOptions,
  participantId: ParticipantId,
): LiveRoomHandle {
  const backend: SignalingBackend = options.backend ?? "nostr";
  const joinFn = JOIN_BY_BACKEND[backend];
  if (!joinFn) {
    throw new Error(
      `Unknown signaling backend "${backend}" — supported: ${Object.keys(JOIN_BY_BACKEND).join(", ")}`,
    );
  }
  const appId = options.appId ?? "kukui-live";
  // Pass an explicit relayUrls list so Trystero never falls back to its
  // bundled default — one of those relays triggers a browser password
  // prompt during WS upgrade. Author-supplied options.relayUrls wins.
  const relayUrls =
    options.relayUrls && options.relayUrls.length > 0
      ? options.relayUrls
      : [...DEFAULT_RELAYS_BY_BACKEND[backend]];
  // Always set an explicit ICE server list. STUN is required for NAT
  // traversal between peers on different networks/devices — without it,
  // only same-machine/same-LAN peers connect (the symptom in issue #8).
  // A configured TURN server is appended as a relay fallback for the
  // restrictive symmetric-NAT / UDP-blocked networks common on campuses,
  // where STUN alone can't punch through.
  const iceServers: RTCIceServer[] = [...DEFAULT_STUN_SERVERS];
  if (options.turn?.url) {
    iceServers.push({
      urls: options.turn.url,
      ...(options.turn.username !== undefined ? { username: options.turn.username } : {}),
      ...(options.turn.credential !== undefined
        ? { credential: options.turn.credential }
        : {}),
    });
  }
  const room: TrysteroRoom = joinFn(
    {
      appId,
      relayUrls,
      rtcConfig: { iceServers },
    },
    code,
  );

  const doc = new Y.Doc();
  const presenceMap = doc.getMap<Presence>("__presence__");

  // Y.js → Trystero binding: send updates as binary, apply incoming.
  const [sendDocUpdate, onDocUpdate] = room.makeAction<Uint8Array>("doc");
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin !== "remote") sendDocUpdate(update);
  });
  onDocUpdate((update) => {
    Y.applyUpdate(doc, update, "remote");
  });

  // On peer join, send a full state snapshot so they catch up.
  room.onPeerJoin(() => {
    sendDocUpdate(Y.encodeStateAsUpdate(doc));
  });

  return {
    code,
    doc,
    participantId,
    backend,
    setPresence(p) {
      presenceMap.set(participantId, {
        ...p,
        id: participantId,
        joinedAt: Date.now(),
      });
    },
    presence() {
      const out = new Map<ParticipantId, Presence>();
      presenceMap.forEach((value, key) => out.set(key, value));
      return out;
    },
    onPeerJoin(cb) {
      const handler = (id: string) => cb(id);
      room.onPeerJoin(handler);
      // Trystero doesn't expose remove, but rooms are short-lived — leave on `leave()`.
      return () => {
        /* handled by leave() */
        void handler;
      };
    },
    onPeerLeave(cb) {
      const handler = (id: string) => cb(id);
      room.onPeerLeave(handler);
      return () => {
        void handler;
      };
    },
    leave() {
      room.leave();
      doc.destroy();
    },
  };
}

function generateParticipantId(): ParticipantId {
  // ~96-bit random — enough for a single room. Crypto-quality not required;
  // the room is the only namespace.
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hashes a 6-digit instructor code → a Trystero room name.
 * Same code on different campuses = different rooms (because of `appId`),
 * so we don't collide accidentally.
 */
export async function deriveRoomCode(instructorCode: string): Promise<string> {
  const data = new TextEncoder().encode(instructorCode);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Display-friendly labels for each backend (used by the lobby picker). */
export const SIGNALING_BACKEND_LABELS: Record<SignalingBackend, string> = {
  nostr: "Nostr relays (default — federated, edu-friendly)",
  mqtt: "MQTT brokers (fallback if Nostr is blocked)",
};

export const SIGNALING_BACKENDS: readonly SignalingBackend[] = ["nostr", "mqtt"];
