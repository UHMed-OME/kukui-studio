import { useEffect, useState } from "react";
import {
  type LivePhase,
  type LiveRoomHandle,
  getRoomState,
} from "@kukui/live";

/**
 * Subscribes to the room's shared phase state.
 *
 * Backed by the Y.js map owned by `RoomStateController` (`getRoomState`).
 * Any peer's `setPhase` call propagates to all peers via Y.js update events.
 *
 * Only the instructor may drive the phase: `setPhase` is a no-op unless the
 * local role is "instructor". This is a local speed-bump, not a security
 * boundary — in P2P mode every client holds the shared doc, so integrity is
 * advisory and a modified client can still write. The transport level does
 * not enforce write permission.
 */
export function usePhase(
  room: LiveRoomHandle,
  role: "instructor" | "student",
): {
  phase: LivePhase;
  setPhase: (next: LivePhase) => void;
} {
  const state = getRoomState(room);
  const [phase, setLocalPhase] = useState<LivePhase>(state.getPhase());

  useEffect(() => {
    // Subscribe via the controller's own Y.js observeDeep wrapper. We pull
    // just the phase out of each snapshot — payload churn shouldn't trigger
    // re-render here.
    const unsubscribe = state.subscribe((snapshot) => {
      setLocalPhase(snapshot.phase);
    });
    return unsubscribe;
    // The controller is recreated per-render but wraps the same Y.Doc, so
    // re-subscribing on each render is cheap. We key the effect on the doc
    // identity rather than the controller instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.doc]);

  return {
    phase,
    setPhase: (next: LivePhase) => {
      if (role !== "instructor") return;
      state.setPhase(next);
    },
  };
}
