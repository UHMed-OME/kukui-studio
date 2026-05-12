import * as Y from "yjs";
import {
  __setRoomFactoryForTest,
  type LiveRoomHandle,
  type ParticipantId,
  type Presence,
  type TransportOptions,
} from "@kukui/live";

/**
 * Test-only: a shared in-memory "mesh" so multiple `joinLiveRoom` calls in
 * the same test return handles that observe the *same* Y.Doc. Approximates
 * the perfect-mesh behavior of Trystero + Y.js without any WebRTC.
 *
 * Reset between tests with `resetMockMesh()`; install with
 * `installMockMeshFactory()`; uninstall with `__setRoomFactoryForTest(null)`.
 */

type MeshSlot = {
  doc: Y.Doc;
  handles: Set<LiveRoomHandle>;
};

const meshes = new Map<string, MeshSlot>();

function getOrCreateSlot(code: string): MeshSlot {
  let slot = meshes.get(code);
  if (!slot) {
    slot = {
      doc: new Y.Doc(),
      handles: new Set<LiveRoomHandle>(),
    };
    meshes.set(code, slot);
  }
  return slot;
}

export function resetMockMesh(): void {
  for (const slot of meshes.values()) {
    slot.doc.destroy();
  }
  meshes.clear();
}

export function installMockMeshFactory(): void {
  __setRoomFactoryForTest((code, _options: TransportOptions, participantId) => {
    const slot = getOrCreateSlot(code);
    const presenceMap = slot.doc.getMap<Presence>("__presence__");

    const handle: LiveRoomHandle = {
      code,
      doc: slot.doc,
      participantId,
      backend: "nostr",
      setPresence(p) {
        const record: Presence = {
          ...p,
          id: participantId,
          joinedAt: Date.now(),
        };
        presenceMap.set(participantId, record);
      },
      presence() {
        const out = new Map<ParticipantId, Presence>();
        presenceMap.forEach((value, key) => out.set(key, value));
        return out;
      },
      onPeerJoin() {
        return () => {};
      },
      onPeerLeave() {
        return () => {};
      },
      leave() {
        slot.handles.delete(handle);
        presenceMap.delete(participantId);
        if (slot.handles.size === 0) {
          slot.doc.destroy();
          meshes.delete(code);
        }
      },
    };
    slot.handles.add(handle);
    return handle;
  });
}
