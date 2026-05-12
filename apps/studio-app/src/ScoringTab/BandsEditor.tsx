import type { Scoring } from "@kukui/schemas";

type Band = { from: number; to: number; message: string };

/**
 * Per-percentage feedback bands. Each row says "between A and B percent,
 * show this message after submit". Overlapping bands are flagged inline
 * (first matching band wins, so overlap = a message that may never
 * surface).
 */

const DEFAULT_BANDS: Band[] = [
  { from: 0, to: 49, message: "Review the material and try again." },
  { from: 50, to: 84, message: "Solid work — keep going." },
  { from: 85, to: 100, message: "Excellent." },
];

export function BandsEditor({
  scoring,
  onChange,
}: {
  scoring: Extract<Scoring, { mode: "points" }>;
  onChange: (next: Scoring) => void;
}) {
  const bands: Band[] = scoring.bands ?? [];

  const setBands = (next: Band[]) => {
    if (next.length === 0) {
      const copy = { ...scoring };
      delete copy.bands;
      onChange(copy);
      return;
    }
    onChange({ ...scoring, bands: next });
  };

  const updateBand = (i: number, patch: Partial<Band>) => {
    setBands(bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  };
  const removeBand = (i: number) => setBands(bands.filter((_, idx) => idx !== i));
  const addBand = () => {
    if (bands.length === 0) {
      setBands(DEFAULT_BANDS);
      return;
    }
    const last = bands[bands.length - 1]!;
    const from = Math.min(100, last.to + 1);
    setBands([...bands, { from, to: 100, message: "" }]);
  };

  const overlapFlags = computeOverlapFlags(bands);

  return (
    <div className="ks-scoring-section">
      <h3 className="ks-scoring-section-title">Feedback messages (optional)</h3>
      <p className="ks-scoring-help">
        Show a different message after submit depending on the learner's percentage.
        The first matching range wins.
      </p>
      {bands.length === 0 ? (
        <p className="ks-scoring-empty">
          No feedback messages yet. Add bands below to praise high scores and direct
          low scorers to remediation.
        </p>
      ) : (
        <ul className="ks-scoring-bands">
          {bands.map((b, i) => (
            <li key={i} className="ks-scoring-band">
              <div className="ks-scoring-band-range">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={b.from}
                  aria-label={`Band ${i + 1} lower bound`}
                  onChange={(e) =>
                    updateBand(i, { from: clampPct(Number(e.target.value)) })
                  }
                />
                <span aria-hidden="true">–</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={b.to}
                  aria-label={`Band ${i + 1} upper bound`}
                  onChange={(e) =>
                    updateBand(i, { to: clampPct(Number(e.target.value)) })
                  }
                />
                <span aria-hidden="true">%</span>
              </div>
              <input
                type="text"
                className="ks-scoring-band-message"
                placeholder="Message learners see after submit"
                value={b.message}
                aria-label={`Band ${i + 1} message`}
                onChange={(e) => updateBand(i, { message: e.target.value })}
              />
              <button
                type="button"
                className="ks-scoring-band-remove"
                onClick={() => removeBand(i)}
                aria-label={`Remove band ${i + 1}`}
              >
                ✕
              </button>
              {overlapFlags[i] ? (
                <p className="ks-scoring-band-warn" role="status">
                  Overlaps with another band — the earlier band wins.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="ks-scoring-band-add" onClick={addBand}>
        {bands.length === 0 ? "Add three example bands" : "+ Add band"}
      </button>
    </div>
  );
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeOverlapFlags(bands: readonly Band[]): boolean[] {
  return bands.map((b, i) => {
    return bands.some((other, j) => {
      if (i === j) return false;
      return !(b.to < other.from || b.from > other.to);
    });
  });
}
