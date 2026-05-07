import { joinRoom as trysteroJoin } from "trystero";
import type { Room as TrysteroRoom } from "trystero";
import * as Y from "yjs";
import type { ParticipantId, Presence, TransportOptions } from "./types.js";

/**
 * Trystero + Y.js transport wrapper.
 *
 * `joinLiveRoom(code, options)` opens a P2P mesh signaled over public
 * BitTorrent trackers (Trystero default), then establishes a Y.Doc shared
 * across the mesh for CRDT-merged room state.
 *
 * The returned handle exposes:
 *   - `doc`: a Y.Doc that all peers see merge-consistently
 *   - `presence`: a Map<ParticipantId, Presence> backed by Y.js awareness
 *   - `onPeerJoin / onPeerLeave`: lightweight subscription
 *   - `leave()`: graceful teardown — fires LMSFinish via the host page's SCORM driver
 *
 * Mocked in tests via `__setRoomFactoryForTest`.
 */

export interface LiveRoomHandle {
  code: string;
  doc: Y.Doc;
  participantId: ParticipantId;
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

function realRoomFactory(
  code: string,
  options: TransportOptions,
  participantId: ParticipantId,
): LiveRoomHandle {
  const appId = options.appId ?? "kukui-live";
  const room: TrysteroRoom = trysteroJoin(
    {
      appId,
      ...(options.turn?.url
        ? {
            rtcConfig: {
              iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                {
                  urls: options.turn.url,
                  username: options.turn.username,
                  credential: options.turn.credential,
                },
              ],
            },
          }
        : {}),
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
