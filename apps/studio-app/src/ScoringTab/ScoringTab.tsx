import type { ActivityKind } from "@kukui/core";
import type { Scoring, ScoringMode } from "@kukui/schemas";
import { BandsEditor } from "./BandsEditor.js";
import { GradebookPreview } from "./GradebookPreview.js";
import { PassThresholdSlider } from "./PassThresholdSlider.js";
import { RetrySolutionToggles } from "./RetrySolutionToggles.js";
import { ScoringModePicker } from "./ScoringModePicker.js";
import { modeAvailabilityFor } from "./modeAvailability.js";
import {
  buildFreshScoring,
  defaultScoring,
  readScoring,
  withScoring,
} from "./scoringHelpers.js";

/**
 * Scoring tab — top-level pane between Editor and Raw JSON. Owns every
 * author-facing knob that determines what the LMS gradebook sees when
 * the learner finishes the activity.
 *
 * Hidden for Live activities (Straw Poll, Word Cloud, etc.) — the
 * parent decides whether to render us via `isScoringApplicable`.
 */
export function ScoringTab({
  kind,
  value,
  onChange,
}: {
  kind: ActivityKind;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const availability = modeAvailabilityFor(kind);
  if (!availability) {
    return (
      <div className="ks-scoring-empty-state">
        This activity type doesn't post grades to the LMS.
      </div>
    );
  }

  const scoring = readScoring(value) ?? defaultScoring(kind);
  if (!scoring) {
    // unreachable (defaultScoring only returns null when availability is null)
    return null;
  }

  const setScoring = (next: Scoring) => onChange(withScoring(value, next));
  const setMode = (mode: ScoringMode) => setScoring(buildFreshScoring(mode));

  return (
    <div className="ks-scoring-root">
      <ScoringModePicker
        availability={availability}
        current={scoring.mode}
        onChange={setMode}
      />

      {scoring.mode === "points" ? (
        <>
          <PassThresholdSlider
            value={scoring.passPercentage}
            onChange={(pct) => setScoring({ ...scoring, passPercentage: pct })}
          />
          <RetrySolutionToggles scoring={scoring} onChange={setScoring} />
          <BandsEditor scoring={scoring} onChange={setScoring} />
        </>
      ) : null}

      {scoring.mode === "all-or-nothing" ? (
        <RetrySolutionToggles scoring={scoring} onChange={setScoring} />
      ) : null}

      {scoring.mode === "completion" && availability.modes.length > 1 ? (
        <RetrySolutionToggles scoring={scoring} onChange={setScoring} />
      ) : null}

      <GradebookPreview scoring={scoring} />
    </div>
  );
}

/** Whether the Scoring tab should appear in the navigation for this kind. */
export function isScoringApplicable(kind: ActivityKind): boolean {
  return modeAvailabilityFor(kind) !== null;
}
