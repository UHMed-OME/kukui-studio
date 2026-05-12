import { useState } from "react";
import type { Scoring } from "@kukui/schemas";

/**
 * Plain-language preview of the LMS row a learner will produce, given a
 * simulated score percent. The author can drag the slider to spot-check
 * "what does a 73% look like?" — useful for verifying threshold + bands
 * choices before committing.
 *
 * For Completion mode, the slider is hidden (the LMS row is invariant).
 */
export function GradebookPreview({ scoring }: { scoring: Scoring }) {
  const [simulated, setSimulated] = useState(70);
  const row = computePreviewRow(scoring, simulated);

  return (
    <div className="ks-scoring-section ks-scoring-preview">
      <h3 className="ks-scoring-section-title">What the LMS will record</h3>
      {scoring.mode !== "completion" ? (
        <>
          <label className="ks-scoring-preview-sim">
            <span>Simulated learner score</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={simulated}
              onChange={(e) => setSimulated(Number(e.target.value))}
              aria-label="Simulated learner score"
            />
            <output>{simulated}%</output>
          </label>
        </>
      ) : null}
      <dl className="ks-scoring-preview-row" aria-label="Predicted LMS gradebook row">
        <div>
          <dt>Score</dt>
          <dd>
            <strong>{row.score} / 100</strong>
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <strong className={`ks-scoring-status ks-scoring-status--${row.status}`}>
              {row.status}
            </strong>
          </dd>
        </div>
        {row.feedback ? (
          <div>
            <dt>Feedback shown</dt>
            <dd>"{row.feedback}"</dd>
          </div>
        ) : null}
      </dl>
      <details className="ks-scoring-preview-scorm">
        <summary>Show SCORM 1.2 field values</summary>
        <pre>
{`cmi.core.score.raw    = ${row.score}
cmi.core.score.min    = 0
cmi.core.score.max    = 100
cmi.core.lesson_status = ${row.status}`}
        </pre>
      </details>
    </div>
  );
}

type PreviewRow = {
  score: number;
  status: "passed" | "failed" | "completed";
  feedback: string | null;
};

function computePreviewRow(scoring: Scoring, simulated: number): PreviewRow {
  if (scoring.mode === "completion") {
    return { score: 100, status: "completed", feedback: null };
  }
  if (scoring.mode === "all-or-nothing") {
    const allCorrect = simulated >= 100;
    return {
      score: allCorrect ? 100 : 0,
      status: allCorrect ? "passed" : "failed",
      feedback: null,
    };
  }
  // points mode
  const threshold = scoring.passPercentage ?? 50;
  const passed = simulated >= threshold;
  const feedback = matchBand(scoring.bands, simulated);
  return {
    score: simulated,
    status: passed ? "passed" : "failed",
    feedback,
  };
}

function matchBand(
  bands: { from: number; to: number; message: string }[] | undefined,
  pct: number,
): string | null {
  if (!bands) return null;
  for (const b of bands) {
    if (pct >= b.from && pct <= b.to) return b.message;
  }
  return null;
}
