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
 * Only the instructor view should call `setPhase` — for M1 we don't enforce
 * write permission at the transport level; the student UI simply doesn't
 * expose a control. The first peer's view authoritatively reflects what was
 * written.
 */
export function usePhase(room: LiveRoomHandle): {
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
    setPhase: (next: LivePhase) => state.setPhase(next),
  };
}
