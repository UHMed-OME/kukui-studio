import { useEffect, useId, useMemo, useState } from "react";
import type { Hotspot2DConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { SafeHtml } from "../../safe-html.js";
import "./Hotspot2D.css";

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
export function Hotspot2D({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<Hotspot2DConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();
  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData) ?? { stage: "answering", selectedHotspotId: null, attempts: 0 },
  );

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

  const tryAgainLabel = config.ui?.tryAgainButton ?? "Try again";
  const selectedHotspot = state.selectedHotspotId
    ? config.hotspots.find((h) => h.id === state.selectedHotspotId)
    : null;

  return (
    <div className="kukui-h2d">
      <article className="kukui-h2d__card" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-h2d__title">
          {config.title}
        </HeadingTag>
        <SafeHtml className="kukui-h2d__prompt" html={config.prompt} />

        <div className="kukui-h2d__image-wrap">
          <img
            src={config.image.src}
            alt={config.image.alt ?? ""}
            className="kukui-h2d__image"
            draggable={false}
          />
          {showMarkers
            ? config.hotspots.map((h) => {
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
                    aria-label={h.label ?? `Hotspot ${h.id}`}
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
            {config.hotspots.map((h) => {
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
                    <span>{h.label ?? h.id}</span>
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
              Check
            </button>
          ) : null}
          {submitted && config.behaviour?.enableRetry ? (
            <button type="button" className="kukui-h2d__secondary" onClick={tryAgain}>
              {tryAgainLabel}
            </button>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (parsed && typeof parsed.attempts === "number") {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "answering",
        selectedHotspotId:
          typeof parsed.selectedHotspotId === "string" ? parsed.selectedHotspotId : null,
        attempts: parsed.attempts,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
