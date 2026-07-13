import { useEffect, useId, useMemo, useState } from "react";
import type { Hotspot2DConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { ActivityHeader, SafeHtml } from "@kukui/core";
import { resolveScoring } from "@kukui/core/scoring";
import "./Component.css";

type Stage = "answering" | "submitted";

type State = {
  stage: Stage;
  selectedHotspotId: string | null;
  attempts: number;
};

/**
 * Image Hotspot 2D — pick a labeled region of a 2D image.
 *
 * The image renders below the prompt; hotspots are absolutely-positioned
 * rectangles overlaid in normalized 0..1 coordinates. Click selects
 * (visible focus ring), Check submits. A keyboard fallback list below
 * the image lets non-mouse users hit the same regions by name.
 */
export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<Hotspot2DConfig>) {
  const headingId = useId();
  const [state, setState] = useState<State>(
    () =>
      parseSuspend(suspendData, config) ?? {
        stage: "answering",
        selectedHotspotId: null,
        attempts: 0,
      },
  );

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(
      parseSuspend(suspendData, config) ?? {
        stage: "answering",
        selectedHotspotId: null,
        attempts: 0,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const correctHotspot = useMemo(
    () => config.hotspots.find((h) => h.correct),
    [config.hotspots],
  );
  const submitted = state.stage === "submitted";
  const showMarkers = config.behaviour?.showHotspotMarkers ?? true;

  const select = (id: string) => {
    if (submitted) return;
    setState((s) => ({ ...s, selectedHotspotId: id }));
  };

  const submit = () => {
    if (submitted || state.selectedHotspotId === null) return;
    const hot = config.hotspots.find((h) => h.id === state.selectedHotspotId);
    if (!hot) return;
    const success = hot.correct === true;
    const next: State = { ...state, stage: "submitted", attempts: state.attempts + 1 };
    setState(next);
    onSubmit({
      raw: success ? 1 : 0,
      max: 1,
      success,
      suspendData: JSON.stringify(next),
    });
  };

  const tryAgain = () =>
    setState({ stage: "answering", selectedHotspotId: null, attempts: state.attempts });

  // Retry comes from the resolved scoring view: Studio's migrator strips
  // behaviour.enableRetry into scoring.enableRetry, so reading
  // config.behaviour directly is a dead path for re-saved content.
  // resolveScoring still honors legacy behaviour blocks in old fixtures.
  const scoring = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);

  const tryAgainLabel = config.ui?.tryAgainButton ?? "Try again";
  const checkLabel = config.ui?.checkAnswerButton ?? "Check";
  const selectedHotspot = state.selectedHotspotId
    ? config.hotspots.find((h) => h.id === state.selectedHotspotId)
    : null;

  return (
    <div className="kukui-h2d">
      <article className="kukui-h2d__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          prompt={config.prompt ? <SafeHtml html={config.prompt} /> : undefined}
        />

        <div className="kukui-h2d__image-wrap">
          {config.image ? (
            <img
              src={config.image.src}
              alt={config.image.alt ?? ""}
              className="kukui-h2d__image"
              draggable={false}
            />
          ) : (
            <div className="kukui-h2d__empty" role="status">
              <strong>Add an image to enable this activity.</strong>
              <span>Open the Editor tab and pick an image to mark up.</span>
            </div>
          )}
          {showMarkers && config.image
            ? config.hotspots.map((h, i) => {
                const isSelected = h.id === state.selectedHotspotId;
                const isCorrect = submitted && isSelected && h.correct;
                const isWrong = submitted && isSelected && !h.correct;
                const reveal = submitted && !isSelected && h.correct;
                return (
                  <button
                    key={h.id}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={submitted}
                    className={[
                      "kukui-h2d__hotspot",
                      isSelected ? "is-selected" : "",
                      isCorrect ? "is-correct" : "",
                      isWrong ? "is-incorrect" : "",
                      reveal ? "is-reveal" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      left: `${h.rect.x * 100}%`,
                      top: `${h.rect.y * 100}%`,
                      width: `${h.rect.w * 100}%`,
                      height: `${h.rect.h * 100}%`,
                    }}
                    onClick={() => select(h.id)}
                    // Prefer the human label; unlabeled hotspots get their
                    // 1-based position rather than the raw config id.
                    aria-label={h.label ?? `Hotspot ${i + 1}`}
                  >
                    {h.label ? <span className="kukui-h2d__hotspot-label">{h.label}</span> : null}
                  </button>
                );
              })
            : null}
        </div>

        <fieldset className="kukui-h2d__fallback" disabled={submitted}>
          <legend className="kukui-h2d__fallback-legend">
            Or pick by name (keyboard / screen-reader equivalent)
          </legend>
          <ul className="kukui-h2d__fallback-list">
            {config.hotspots.map((h, i) => {
              const isSelected = h.id === state.selectedHotspotId;
              const isCorrect = submitted && isSelected && h.correct;
              const isWrong = submitted && isSelected && !h.correct;
              const reveal = submitted && !isSelected && h.correct;
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className={[
                      "kukui-h2d__fb-btn",
                      isSelected ? "is-selected" : "",
                      isCorrect ? "is-correct" : "",
                      isWrong ? "is-incorrect" : "",
                      reveal ? "is-reveal" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => select(h.id)}
                  >
                    <span>{h.label ?? `Hotspot ${i + 1}`}</span>
                    <span className="kukui-h2d__fb-icon" aria-hidden="true">
                      {isCorrect ? "✓" : isWrong ? "✗" : reveal ? "○" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div
          className={["kukui-h2d__feedback", submitted ? "is-visible" : ""]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {submitted && selectedHotspot ? (
            <>
              <strong>{selectedHotspot.correct ? "Correct." : "Not quite."}</strong>{" "}
              {selectedHotspot.feedback ??
                (selectedHotspot.correct
                  ? "Nice work."
                  : `The correct region was “${correctHotspot?.label ?? correctHotspot?.id ?? ""}”.`)}
            </>
          ) : null}
        </div>

        <div className="kukui-h2d__actions">
          {!submitted ? (
            <button
              type="button"
              className="kukui-h2d__primary"
              disabled={state.selectedHotspotId === null}
              onClick={submit}
            >
              {checkLabel}
            </button>
          ) : null}
          {submitted && scoring.enableRetry ? (
            <button type="button" className="kukui-h2d__secondary" onClick={tryAgain}>
              {tryAgainLabel}
            </button>
          ) : null}
        </div>

        {config.image?.attribution ? (
          <ImageAttribution attribution={config.image.attribution} />
        ) : null}
      </article>
    </div>
  );
}

/**
 * Creative-Commons-style credit line for the activity image. Always
 * rendered when `image.attribution` is present, regardless of license:
 * most CC variants require attribution (CC0 doesn't but a courtesy credit
 * remains good practice). License name + URL link out to the canonical
 * license page if `licenseUrl` is set.
 */
function ImageAttribution({
  attribution,
}: {
  attribution: NonNullable<NonNullable<Hotspot2DConfig["image"]>["attribution"]>;
}) {
  const { author, authorUrl, sourceUrl, license, licenseUrl } = attribution;
  return (
    <footer className="kukui-h2d__attribution">
      <span>Image by </span>
      {authorUrl ? (
        <a href={authorUrl} target="_blank" rel="noopener noreferrer">
          {author}
        </a>
      ) : (
        <span>{author}</span>
      )}
      {sourceUrl ? (
        <>
          <span> · </span>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            View original
          </a>
        </>
      ) : null}
      {license ? (
        <>
          <span> · </span>
          {licenseUrl ? (
            <a href={licenseUrl} target="_blank" rel="noopener noreferrer">
              {license}
            </a>
          ) : (
            <span>{license}</span>
          )}
        </>
      ) : null}
    </footer>
  );
}

function parseSuspend(s: string | undefined, config: Hotspot2DConfig): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (parsed && typeof parsed.attempts === "number") {
      // Validate the persisted id against the live config: a hotspot
      // removed by a re-published activity must not resurrect as a
      // phantom selection.
      const selectedHotspotId =
        typeof parsed.selectedHotspotId === "string" &&
        config.hotspots.some((h) => h.id === parsed.selectedHotspotId)
          ? parsed.selectedHotspotId
          : null;
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "answering",
        selectedHotspotId,
        attempts: parsed.attempts,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
