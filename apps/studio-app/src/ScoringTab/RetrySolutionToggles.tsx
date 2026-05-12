import type { Scoring } from "@kukui/schemas";

/**
 * After-submit affordances: "Try again" + "Show solution".
 *
 * `enableSolutionsButton` is only meaningful for Points + All-or-nothing
 * (Completion has no solution to reveal), so the second checkbox is
 * hidden when the mode is completion.
 */
export function RetrySolutionToggles({
  scoring,
  onChange,
}: {
  scoring: Scoring;
  onChange: (next: Scoring) => void;
}) {
  const enableRetry = scoring.enableRetry ?? true;
  const enableSolutions =
    scoring.mode !== "completion" ? scoring.enableSolutionsButton ?? false : false;

  const setRetry = (v: boolean) => {
    onChange({ ...scoring, enableRetry: v });
  };
  const setSolutions = (v: boolean) => {
    if (scoring.mode === "completion") return;
    onChange({ ...scoring, enableSolutionsButton: v });
  };

  return (
    <div className="ks-scoring-section">
      <h3 className="ks-scoring-section-title">After the learner submits</h3>
      <label className="ks-scoring-checkbox">
        <input
          type="checkbox"
          checked={enableRetry}
          onChange={(e) => setRetry(e.target.checked)}
        />
        <span>
          <strong>Let learners try again.</strong> A "Try again" button appears after
          submit; subsequent attempts overwrite the previous score in the LMS.
        </span>
      </label>
      {scoring.mode !== "completion" ? (
        <label className="ks-scoring-checkbox">
          <input
            type="checkbox"
            checked={enableSolutions}
            onChange={(e) => setSolutions(e.target.checked)}
          />
          <span>
            <strong>Show the correct answer on request.</strong> A "Show solution"
            button reveals the right answer after the learner submits. Useful for
            formative work; off for graded work.
          </span>
        </label>
      ) : null}
    </div>
  );
}
