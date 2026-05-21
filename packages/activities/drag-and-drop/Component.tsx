import { useCallback, useEffect, useId, useMemo, useReducer } from "react";
import type { DragAndDropConfig } from "@kukui/schemas";
import type { ActivityProps } from "@kukui/core/types";
import { resolveScoring } from "@kukui/core/scoring";
import { DragLayer } from "./DragLayer.js";
import { TapLayer } from "./TapLayer.js";
import {
  initial,
  isCorrect,
  parseSuspend,
  reducer as baseReducer,
  solutionAssignment,
  type Action,
  type State,
} from "./state.js";
import { useInteractionMode } from "./useInteractionMode.js";
import "./Component.css";

/**
 * Top-level Drag-and-Drop activity. Owns the state machine; delegates
 * presentation to either DragLayer (mouse / pen / keyboard via dnd-kit
 * KeyboardSensor) or TapLayer (touch / tap-to-place + aria-live).
 *
 * Both layers dispatch the same actions to the reducer — there is one
 * source of truth for placement.
 *
 * Author override (`behaviour.interaction`) wins over auto-detection;
 * below 760 px the runtime always uses TapLayer regardless of override.
 */

export function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<DragAndDropConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();

  // Reducer needs the config for capacity / chip / zone lookups —
  // wrap baseReducer with a closure so React sees a 2-arg reducer.
  const reducer = useCallback(
    (state: State, action: Action) => baseReducer(state, action, config),
    [config],
  );

  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => parseSuspend(suspendData, config) ?? initial(config),
  );

  // Rehydrate when config changes (Studio Preview edit, draft load).
  useEffect(() => {
    dispatch({
      type: "rehydrate",
      state: parseSuspend(suspendData, config) ?? initial(config),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Persist on every state change.
  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const mode = useInteractionMode(config.behaviour?.interaction);

  // Unified place callback — both DragLayer (drag-end) and Zone (tap)
  // dispatch through here.
  const onPlace = useCallback(
    (chipId: string, zoneId: string | null) => {
      dispatch({ type: "place", chipId, zoneId });
    },
    [],
  );

  const onSelectChip = useCallback((id: string) => {
    dispatch({ type: "select-chip", id });
  }, []);

  // Zone tap places the currently-selected chip (if any).
  const onTapZone = useCallback(
    (zoneId: string) => {
      if (!state.selectedChipId) return;
      dispatch({ type: "place", chipId: state.selectedChipId, zoneId });
    },
    [state.selectedChipId],
  );

  // Tap on a placed chip lifts it back to the tray and selects it.
  const onLiftFromZone = useCallback(
    (chipId: string) => {
      dispatch({ type: "place", chipId, zoneId: null });
      // Then arm it for re-placement, so a touch user can move it
      // straight to a new zone without an extra tap.
      // (Reducer ignores select-chip when stage !== "answering"; that's fine.)
      dispatch({ type: "select-chip", id: chipId });
    },
    [],
  );

  const scoring = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);
  const isSinglePoint = scoring.mode === "all-or-nothing";

  const onCheck = useCallback(() => {
    if (state.stage !== "answering") return;
    const total = config.draggables.length;
    const correct = Object.entries(state.placement).filter(([id, zid]) =>
      isCorrect(id, zid, config),
    ).length;
    const max = isSinglePoint ? 1 : total;
    const allRight = correct === total;
    const raw = isSinglePoint ? (allRight ? 1 : 0) : correct;
    // Snapshot the state we're about to commit to so the suspend
    // payload matches what the LMS thinks the final score is.
    const next: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    dispatch({ type: "submit" });
    onSubmit({
      raw,
      max,
      success: allRight,
      suspendData: JSON.stringify(next),
    });
  }, [state, config, isSinglePoint, onSubmit]);

  const onTryAgain = useCallback(() => {
    dispatch({ type: "try-again", initial: initial(config) });
  }, [config]);

  const assignment = useMemo(() => solutionAssignment(config), [config]);
  const onShowSolution = useCallback(() => {
    dispatch({ type: "show-solution", assignment });
  }, [assignment]);

  const callbacks = {
    onSelectChip,
    onTapZone,
    onLiftFromZone,
    onCheck,
    onTryAgain,
    onShowSolution,
  };

  if (mode === "drag") {
    return (
      <DragLayer
        config={config}
        state={state}
        mode="drag"
        headingId={headingId}
        HeadingTag={HeadingTag}
        callbacks={callbacks}
        onPlace={onPlace}
      />
    );
  }
  return (
    <TapLayer
      config={config}
      state={state}
      mode="tap"
      headingId={headingId}
      HeadingTag={HeadingTag}
      callbacks={callbacks}
    />
  );
}

export default Component;
