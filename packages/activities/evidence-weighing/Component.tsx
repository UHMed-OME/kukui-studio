import { useEffect, useId, useMemo, useState } from "react";
import type { EvidenceWeighingConfig } from "@kukui/schemas";
import type { ActivityProps } from "@kukui/core/types";
import {
  bandMessage,
  percentage,
  resolveScoring,
} from "@kukui/core/scoring";
import { ActivityHeader, SafeHtml } from "@kukui/core";
import "./Component.css";


type ClaimState = {
  stage: "answering" | "submitted";
  ratings: Record<number, string>;
  attempts: number;
  solutionsRevealed: boolean;
};

type State = {
  claims: ClaimState[];
}

function initialClaimState(): ClaimState {
  return {
    stage: "answering",
    ratings: {},
    attempts: 0,
    solutionsRevealed: false,
  };
};

function initialState(config: EvidenceWeighingConfig): State {
  return {
    claims: config.claims.map(() => initialClaimState()),
  };
};

function claimScore(
  claim: EvidenceWeighingConfig["claims"][number],
  state: ClaimState | undefined,
) {
  const ratings = state?.ratings ?? {};

  const correctCount = claim.evidence.filter(
    (item, index) => ratings[index] === item.expectedRating,
  ).length;

  return {
    raw: correctCount,
    max: claim.evidence.length,
    success: correctCount === claim.evidence.length,
  };
}

function overallScore(config: EvidenceWeighingConfig, state: State) {
  const scores = config.claims.map((claim, index) =>
    claimScore(claim, state.claims[index]!),
  );

  const raw = scores.reduce((total, score) => total + score.raw, 0);
  const max = scores.reduce((total, score) => total + score.max, 0);

  return {
    raw,
    max,
    success: raw === max,
  };
}

export function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<EvidenceWeighingConfig>) {
  const [savedConfig, setSavedConfig] = useState(config);
  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, config) ?? initialState(config),
  );
  if (savedConfig !== config) {
    setSavedConfig(config);
    setState(parseSuspend(suspendData, config) ?? initialState(config));
  }
  const headingId = useId();

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const scoring = useMemo(
    () => resolveScoring(config, { mode: "points" }),
    [config],
  )

  const selectRating = (claimIndex: number, evidenceIndex: number, ratingId: string) => {
    setState((previous) => ({
      claims: previous.claims.map((claimState, index) => {
        if (index !== claimIndex || claimState.stage !== "answering") {
          return claimState;
        }

        return {
          ...claimState,
          ratings: {
            ...claimState.ratings,
            [evidenceIndex]: ratingId,
          },
        };
      }),
    }));
  };

  const submitClaim = (claimIndex: number) => {
    const claim = config.claims[claimIndex];
    const claimState = state.claims[claimIndex];

    if (!claim || !claimState || claimState.stage !== "answering") {
      return;
    }

    // Every evidence item must have a rating before submission.
    const allAnswered = claim.evidence.every(
      (_, index) => claimState.ratings[index] !== undefined,
    );

    if (!allAnswered) return;

    const next: State = {
      claims: state.claims.map((current, index) =>
        index === claimIndex
          ? {
              ...current,
              stage: "submitted" as const,
              attempts: current.attempts + 1,
            }
          : current,
      ),
    };

    setState(next);

    // Report one overall result after all claims are submitted.
    const allSubmitted = next.claims.every(
      (current) => current.stage === "submitted",
    );

    if (allSubmitted) {
      onSubmit({
        ...overallScore(config, next),
        suspendData: JSON.stringify(next),
      });
    }
  };

  const tryAgain = (claimIndex: number) => {
    setState((previous) => ({
      claims: previous.claims.map((current, index) =>
        index === claimIndex
          ? {
              ...initialClaimState(),
              attempts: current.attempts,
            }
          : current,
      ),
    }));
  };

  const revealSolutions = (claimIndex: number) => {
    setState((previous) => ({
      claims: previous.claims.map((current, index) =>
        index === claimIndex && current.stage === "submitted"
          ? { ...current, solutionsRevealed: true }
          : current,
      ),
    }));
  };

  const ui = config.ui ?? {};
  const checkLabel = ui.checkAnswerButton ?? "Check";
  const solutionLabel = ui.showSolutionButton ?? "Show solution";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";

  const claimHeadingLevel = Math.min(headingLevel + 1, 6);
  const ClaimHeading = `h${claimHeadingLevel}` as
  keyof Pick<React.JSX.IntrinsicElements, "h1" | "h2" | "h3" | "h4" | "h5" | "h6">;

  return (
    <div className="kukui-ew">
      <article className="kukui-ew__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
        />
          {config.claims.map((claim, claimIndex) => {
          const claimState = state.claims[claimIndex] ?? initialClaimState();
          const score = claimScore(claim, claimState);
          const submitted = claimState.stage === "submitted";

          const allAnswered = claim.evidence.every(
            (_, index) => claimState.ratings[index] !== undefined,
          );

          const pct = submitted ? percentage(score) : 0;
          const banner = submitted
            ? bandMessage(scoring.bands, pct)
            : null;

          const claimId = `${headingId}-claim-${claimIndex}`;

          return (
            <section
              key={claimIndex}
              className="kukui-ew__claim"
              aria-labelledby={claimId}
            >
              <ClaimHeading id={claimId}>
                Claim {claimIndex + 1}
              </ClaimHeading>

              <SafeHtml html={claim.claim} />

              <div className="kukui-ew__evidence-list">
                {claim.evidence.map((item, evidenceIndex) => {
                  const selectedRating =
                    claimState.ratings[evidenceIndex];

                  const isCorrect =
                    selectedRating === item.expectedRating;

                  const expectedRating = config.ratings.find(
                    (rating) => rating.id === item.expectedRating,
                  );

                  const evidenceId =
                    `${claimId}-evidence-${evidenceIndex}`;

                  return (
                    <div
                      key={evidenceIndex}
                      className="kukui-ew__evidence"
                    >
                      <p id={evidenceId}>{item.text}</p>

                      <div
                        className="kukui-ew__ratings"
                        role="group"
                        aria-labelledby={evidenceId}
                      >
                        {config.ratings.map((rating) => (
                          <label
                            key={rating.id}
                            className="kukui-ew__rating"
                          >
                            <input
                              type="radio"
                              name={evidenceId}
                              checked={selectedRating === rating.id}
                              disabled={submitted}
                              onChange={() =>
                                selectRating(
                                  claimIndex,
                                  evidenceIndex,
                                  rating.id,
                                )
                              }
                            />
                            {rating.label}
                          </label>
                        ))}
                      </div>

                      {submitted && (
                        <div className="kukui-ew__feedback">
                          <p>{isCorrect ? "Correct" : "Incorrect"}</p>
                          {item.feedback && <p>{item.feedback}</p>}
                        </div>
                      )}

                      {submitted && claimState.solutionsRevealed && (
                        <p className="kukui-ew__solution">
                          Expected rating: {expectedRating?.label}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="kukui-ew__actions">
                {!submitted ? (
                  <button
                    type="button"
                    className="kukui-ew__primary"
                    disabled={!allAnswered}
                    onClick={() => submitClaim(claimIndex)}
                  >
                    {checkLabel}
                  </button>
                ) : (
                  <>
                    <output className="kukui-ew__score">
                      {score.raw} / {score.max}
                      {banner ? (
                        <span className="kukui-ew__band">
                          {" — "}{banner}
                        </span>
                      ) : null}
                    </output>

                    {scoring.enableRetry && (
                      <button
                        type="button"
                        className="kukui-ew__secondary"
                        onClick={() => tryAgain(claimIndex)}
                      >
                        {tryAgainLabel}
                      </button>
                    )}

                    {scoring.enableSolutionsButton &&
                      !claimState.solutionsRevealed && (
                        <button
                          type="button"
                          className="kukui-ew__secondary"
                          onClick={() => revealSolutions(claimIndex)}
                        >
                          {solutionLabel}
                        </button>
                      )}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </article>
    </div>
  );
}

function parseSuspend(
  suspendData: string | undefined,
  config: EvidenceWeighingConfig,
): State | null {
  if (!suspendData) return null;

  try {
    const parsed: unknown = JSON.parse(suspendData);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("claims" in parsed) ||
      !Array.isArray(parsed.claims) ||
      parsed.claims.length !== config.claims.length
    ) {
      return null;
    }

    const claims: ClaimState[] = [];

    for (const [index, saved] of parsed.claims.entries()) {
      if (
        typeof saved !== "object" ||
        saved === null ||
        !("ratings" in saved) ||
        typeof saved.ratings !== "object" ||
        saved.ratings === null ||
        Array.isArray(saved.ratings) ||
        !("attempts" in saved) ||
        typeof saved.attempts !== "number" ||
        !Number.isSafeInteger(saved.attempts) ||
        saved.attempts < 0 ||
        !("stage" in saved) ||
        (saved.stage !== "answering" &&
          saved.stage !== "submitted")
      ) {
        return null;
      }

      const ratings = saved.ratings as Record<string, unknown>;
      const evidence = config.claims[index]!.evidence;
      const validIds = new Set(config.ratings.map((rating) => rating.id));

      if (
        Object.entries(ratings).some(
          ([key, value]) =>
            !/^(0|[1-9]\d*)$/.test(key) ||
            Number(key) >= evidence.length ||
            typeof value !== "string" ||
            !validIds.has(value),
        )
      ) {
        return null;
      }

      if (
        saved.stage === "submitted" &&
        evidence.some((_, evidenceIndex) => ratings[evidenceIndex] === undefined)
      ) {
        return null;
      }

      claims.push({
        stage: saved.stage,
        ratings: ratings as Record<number, string>,
        attempts: saved.attempts,
        solutionsRevealed:
          "solutionsRevealed" in saved &&
          saved.solutionsRevealed === true,
      });
    }

    return { claims };
  } catch {
    return null;
  }
}

export default Component;
