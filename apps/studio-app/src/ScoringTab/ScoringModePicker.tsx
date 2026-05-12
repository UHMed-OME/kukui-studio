import type { ScoringMode } from "@kukui/schemas";
import { MODE_DESCRIPTIONS, MODE_LABELS, type ModeAvailability } from "./modeAvailability.js";

/**
 * Radio group for picking the scoring mode. Renders only the modes the
 * activity supports. Switching modes emits a fresh `scoring` block (the
 * caller drops the discriminant-irrelevant fields) so the activity
 * runtime always sees a clean shape.
 */

export function ScoringModePicker({
  availability,
  current,
  onChange,
}: {
  availability: ModeAvailability;
  current: ScoringMode;
  onChange: (next: ScoringMode) => void;
}) {
  // One-mode activities don't need a picker — show a flat summary line.
  if (availability.modes.length === 1) {
    const only = availability.modes[0]!;
    return (
      <div className="ks-scoring-section">
        <p className="ks-scoring-help">
          <strong>{MODE_LABELS[only]}.</strong> {MODE_DESCRIPTIONS[only]}
        </p>
      </div>
    );
  }
  return (
    <fieldset className="ks-scoring-section ks-scoring-modes">
      <legend className="ks-scoring-section-title">How is this activity graded?</legend>
      {availability.modes.map((mode) => (
        <label key={mode} className="ks-scoring-mode-option">
          <input
            type="radio"
            name="scoring-mode"
            value={mode}
            checked={current === mode}
            onChange={() => onChange(mode)}
          />
          <div>
            <strong>{MODE_LABELS[mode]}</strong>
            <p>{MODE_DESCRIPTIONS[mode]}</p>
          </div>
        </label>
      ))}
    </fieldset>
  );
}
