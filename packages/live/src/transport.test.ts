import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Exercises the real room factory's peer-event multiplexing with a mocked
 * Trystero backend. The mock mirrors Trystero's actual behavior of storing
 * a SINGLE callback per event (a later registration clobbers the earlier
 * one) — exactly the constraint the transport's fan-out exists to hide.
 */

type PeerHandler = (id: string) => void;

const mesh: {
  joinHandler: PeerHandler | undefined;
  leaveHandler: PeerHandler | undefined;
  sentDocUpdates: Uint8Array[];
} = {
  joinHandler: undefined,
  leaveHandler: undefined,
  sentDocUpdates: [],
};

function makeMockTrysteroRoom() {
  return {
    makeAction: () => [
      (data: Uint8Array) => {
        mesh.sentDocUpdates.push(data);
      },
      (_cb: unknown) => {},
      () => {},
    ],
    // Single-slot, like real Trystero: last registration wins.
    onPeerJoin: (cb: PeerHandler) => {
      mesh.joinHandler = cb;
    },
    onPeerLeave: (cb: PeerHandler) => {
      mesh.leaveHandler = cb;
    },
    leave: () => {},
  };
}

vi.mock("trystero/nostr", () => ({ joinRoom: () => makeMockTrysteroRoom() }));
vi.mock("trystero/mqtt", () => ({ joinRoom: () => makeMockTrysteroRoom() }));

import { deriveRoomCode, joinLiveRoom } from "./transport.js";

beforeEach(() => {
  mesh.joinHandler = undefined;
  mesh.leaveHandler = undefined;
  mesh.sentDocUpdates = [];
});

describe("peer event multiplexing", () => {
  it("fans a peer join out to every subscriber and still sends the snapshot", () => {
    const handle = joinLiveRoom("room-1", {}, "me");
    const first = vi.fn();
    const second = vi.fn();
    handle.onPeerJoin(first);
    handle.onPeerJoin(second);

    const sentBefore = mesh.sentDocUpdates.length;
    mesh.joinHandler?.("peer-9");

    // Both consumer callbacks fire — the second registration must not
    // clobber the first.
    expect(first).toHaveBeenCalledWith("peer-9");
    expect(second).toHaveBeenCalledWith("peer-9");
    // The internal snapshot-on-join (late-joiner sync) still ran too.
    expect(mesh.sentDocUpdates.length).toBe(sentBefore + 1);
  });

  it("unsubscribe removes exactly the one callback", () => {
    const handle = joinLiveRoom("room-2", {}, "me");
    const kept = vi.fn();
    const dropped = vi.fn();
    handle.onPeerJoin(kept);
    const unsubscribe = handle.onPeerJoin(dropped);

    mesh.joinHandler?.("peer-1");
    unsubscribe();
    mesh.joinHandler?.("peer-2");

    expect(kept).toHaveBeenCalledTimes(2);
    expect(dropped).toHaveBeenCalledTimes(1);
  });

  it("fans peer leave out to every subscriber with working unsubscribes", () => {
    const handle = joinLiveRoom("room-3", {}, "me");
    const kept = vi.fn();
    const dropped = vi.fn();
    handle.onPeerLeave(kept);
    const unsubscribe = handle.onPeerLeave(dropped);

    mesh.leaveHandler?.("peer-1");
    unsubscribe();
    mesh.leaveHandler?.("peer-2");

    expect(kept).toHaveBeenCalledTimes(2);
    expect(kept).toHaveBeenLastCalledWith("peer-2");
    expect(dropped).toHaveBeenCalledTimes(1);
  });
});

describe("deriveRoomCode", () => {
  it("is deterministic so instructor and students land in the same room", async () => {
    const a = await deriveRoomCode("cardio-pulse-fall2025");
    const b = await deriveRoomCode("cardio-pulse-fall2025");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(await deriveRoomCode("123456")).not.toBe(a);
  });
});
