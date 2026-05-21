/*
 * State machine for the Drag-and-Drop activity.
 *
 * The reducer is the single source of truth for placement, selection
 * (tap-to-place), and stage. Both the drag layer (DnD-kit) and the tap
 * layer dispatch the same `place` action — keeps the two interaction
 * paths from drifting.
 *
 * `selectedChipId` is only meaningful in tap-to-place mode; it's
 * reset on any successful `place` action so a chip never stays
 * "armed" after landing.
 */

import type { DragAndDropConfig } from "@kukui/schemas";

export type ChipId = string;
export type ZoneId = string;

export type Stage = "answering" | "submitted" | "showing-solution";

export type Placement = Record<ChipId, ZoneId | null>;

export type State = {
  stage: Stage;
  placement: Placement;
  selectedChipId: ChipId | null;
  attempts: number;
};

export type Action =
  | { type: "select-chip"; id: ChipId }
  | { type: "deselect" }
  | { type: "place"; chipId: ChipId; zoneId: ZoneId | null }
  | { type: "submit" }
  | { type: "try-again"; initial: State }
  | { type: "show-solution"; assignment: Record<ChipId, ZoneId> }
  | { type: "rehydrate"; state: State };

/**
 * Build the initial state for a config — all chips in the tray, no
 * selection, no attempts. Used both on mount and on Try-again.
 */
export function initial(config: DragAndDropConfig): State {
  return {
    stage: "answering",
    placement: Object.fromEntries(config.draggables.map((d) => [d.id, null])),
    selectedChipId: null,
    attempts: 0,
  };
}

/**
 * Pure reducer for DnD state. Capacity enforcement lives here so
 * both interaction paths get the same guardrails.
 *
 * Capacity: a zone refuses a new placement when it already holds
 * (capacity ?? 1) occupants and the incoming chip isn't already
 * in it. The action is dropped (state unchanged) — callers don't
 * need to know whether it succeeded; the next render reflects truth.
 */
export function reducer(
  state: State,
  action: Action,
  config: DragAndDropConfig,
): State {
  switch (action.type) {
    case "rehydrate":
      return action.state;

    case "select-chip": {
      if (state.stage !== "answering") return state;
      // Toggle: re-selecting the same chip deselects.
      if (state.selectedChipId === action.id) {
        return { ...state, selectedChipId: null };
      }
      return { ...state, selectedChipId: action.id };
    }

    case "deselect":
      return state.selectedChipId == null ? state : { ...state, selectedChipId: null };

    case "place": {
      if (state.stage !== "answering") return state;
      const { chipId, zoneId } = action;
      // Validate chip exists.
      const chip = config.draggables.find((d) => d.id === chipId);
      if (!chip) return state;
      if (zoneId !== null) {
        const zone = config.dropZones.find((z) => z.id === zoneId);
        if (!zone) return state;
        const cap = zone.capacity ?? 1;
        const already = Object.entries(state.placement).filter(
          ([id, zid]) => zid === zoneId && id !== chipId,
        );
        if (already.length >= cap) return state;
      }
      return {
        ...state,
        placement: { ...state.placement, [chipId]: zoneId },
        // After any successful placement, clear the selection — a
        // selected chip "snaps" when it lands.
        selectedChipId: null,
      };
    }

    case "submit": {
      if (state.stage !== "answering") return state;
      return { ...state, stage: "submitted", attempts: state.attempts + 1 };
    }

    case "try-again":
      return action.initial;

    case "show-solution": {
      if (state.stage !== "submitted") return state;
      // Caller computes the assignment (first correct zone per chip),
      // we just apply it — keeps the reducer config-agnostic for
      // the assignment math (capacity overflows are decided upstream).
      const placement: Placement = { ...state.placement };
      for (const [chipId, zoneId] of Object.entries(action.assignment)) {
        placement[chipId] = zoneId;
      }
      return { ...state, stage: "showing-solution", placement, selectedChipId: null };
    }
  }
}

/**
 * Was this chip correctly placed? Used for scoring + summary rendering.
 */
export function isCorrect(
  chipId: ChipId,
  zoneId: ZoneId | null,
  config: DragAndDropConfig,
): boolean {
  if (!zoneId) return false;
  const chip = config.draggables.find((d) => d.id === chipId);
  if (!chip) return false;
  return chip.correctZones.includes(zoneId);
}

/**
 * Compute a deterministic chip→zone assignment for the "Show solution"
 * button — each chip lands in its first correct zone, but if that zone
 * is already full (capacity exhausted by earlier chips in iteration
 * order), fall back to the next entry in `correctZones`. If none fit
 * the chip is dropped from the assignment (rare — implies authoring
 * mistake).
 */
export function solutionAssignment(
  config: DragAndDropConfig,
): Record<ChipId, ZoneId> {
  const assignment: Record<ChipId, ZoneId> = {};
  const counts = new Map<ZoneId, number>();
  for (const z of config.dropZones) counts.set(z.id, 0);
  for (const chip of config.draggables) {
    for (const zoneId of chip.correctZones) {
      const zone = config.dropZones.find((z) => z.id === zoneId);
      if (!zone) continue;
      const cap = zone.capacity ?? 1;
      const used = counts.get(zoneId) ?? 0;
      if (used < cap) {
        assignment[chip.id] = zoneId;
        counts.set(zoneId, used + 1);
        break;
      }
    }
  }
  return assignment;
}

/**
 * Parse persisted suspendData. Robust to schema drift: only
 * returns a state with placements for chips that still exist
 * in the config. Returns null on any parse failure so callers
 * fall back to `initial(config)`.
 */
export function parseSuspend(
  s: string | undefined,
  config: DragAndDropConfig,
): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (!parsed || typeof parsed.attempts !== "number" || !parsed.placement) return null;
    const placement: Placement = {};
    for (const d of config.draggables) {
      const v = (parsed.placement as Placement)[d.id];
      placement[d.id] = typeof v === "string" || v === null ? v : null;
    }
    const stage: Stage =
      parsed.stage === "submitted"
        ? "submitted"
        : parsed.stage === "showing-solution"
          ? "showing-solution"
          : "answering";
    return {
      stage,
      placement,
      selectedChipId:
        typeof parsed.selectedChipId === "string" ? parsed.selectedChipId : null,
      attempts: parsed.attempts,
    };
  } catch {
    return null;
  }
}
