/**
 * Slider + numeric input for the pass threshold (0–100, integer).
 *
 * `value` is the current passPercentage. When undefined, the slider
 * shows 50 (a neutral default) but the caller decides whether to
 * persist that on first interaction. The change handler always emits
 * a clamped integer.
 */
export function PassThresholdSlider({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (next: number) => void;
}) {
  const v = value ?? 50;
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return (
    <div className="ks-scoring-section">
      <div className="ks-scoring-section-title-row">
        <h3 className="ks-scoring-section-title">Pass threshold</h3>
        <output className="ks-scoring-threshold-value">{v}%</output>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={v}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        aria-label="Pass threshold percentage"
      />
      <div className="ks-scoring-threshold-row">
        <label className="ks-scoring-threshold-input">
          <span>Exactly</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={v}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            aria-label="Pass threshold percentage (precise)"
          />
          <span>%</span>
        </label>
        <p className="ks-scoring-help">
          Learners scoring at or above {v}% are recorded as <strong>passed</strong> in
          the LMS gradebook. Below {v}% records as <strong>failed</strong>.
        </p>
      </div>
    </div>
  );
}
