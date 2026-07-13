import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
} from "react";
import type { ImageComparisonSliderConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { resolveScoring } from "@kukui/core/scoring";
import { ActivityHeader, SafeHtml } from "@kukui/core";
import "./Component.css";

type State = {
  /** Seam position in 0..1. */
  position: number;
  /** Whether the learner has already pressed Done. */
  done: boolean;
};

const NUDGE = 0.01;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<ImageComparisonSliderConfig>) {
  const headingId = useId();

  const initialPosition = useMemo(
    () => clamp01(config.initialPosition ?? 0.5),
    [config.initialPosition],
  );

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData) ?? { position: initialPosition, done: false },
  );

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  /** Active pointerId currently dragging the seam (null when idle). */
  const draggingRef = useRef<number | null>(null);

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(parseSuspend(suspendData) ?? { position: initialPosition, done: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Persist explicitly at interaction boundaries (pointer release, key
  // release, stage click, Done, Try again), not via a state effect, which
  // would fire onPersist once per pointermove during a drag.
  const persist = useCallback(
    (s: State) => {
      if (onPersist) onPersist(JSON.stringify(s));
    },
    [onPersist],
  );

  const setPosition = useCallback((next: number) => {
    setState((s) => ({ ...s, position: clamp01(next) }));
  }, []);

  const positionFromClientX = useCallback((clientX: number): number | null => {
    const el = wrapperRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return clamp01((clientX - rect.left) / rect.width);
  }, []);

  // ---- Pointer handling on the seam handle (drag) ----
  const onSeamPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (state.done) return;
    if (e.button !== undefined && e.button !== 0) return;
    draggingRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onSeamPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (draggingRef.current !== e.pointerId) return;
    const next = positionFromClientX(e.clientX);
    if (next !== null) setPosition(next);
  };

  const releaseDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (draggingRef.current !== e.pointerId) return;
    draggingRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const settled = config.behaviour?.autoSnap ? 0.5 : state.position;
    const next: State = { ...state, position: settled };
    setState(next);
    persist(next);
  };

  // ---- Click anywhere on the wrapper jumps the seam ----
  const onWrapperClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (state.done) return;
    // Avoid double-handling when the click bubbled from the seam handle itself.
    if (
      e.target instanceof HTMLElement &&
      e.target.closest(".kukui-ics__seam, .kukui-ics__done")
    ) {
      return;
    }
    const pos = positionFromClientX(e.clientX);
    if (pos !== null) {
      const next: State = { ...state, position: pos };
      setState(next);
      persist(next);
    }
  };

  // ---- Keyboard on the seam ----
  const onSeamKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (state.done) return;
    let handled = true;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        setPosition(state.position - NUDGE);
        break;
      case "ArrowRight":
      case "ArrowUp":
        setPosition(state.position + NUDGE);
        break;
      case "PageDown":
        setPosition(state.position - NUDGE * 10);
        break;
      case "PageUp":
        setPosition(state.position + NUDGE * 10);
        break;
      case "Home":
        setPosition(0);
        break;
      case "End":
        setPosition(1);
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  };

  // keyup fires once per press (keydown auto-repeats while held), so this
  // saves the settled position without per-repeat persist spam.
  const onSeamKeyUp = () => {
    if (state.done) return;
    persist(state);
  };

  // Scoring slice only: this activity's `behaviour` (autoSnap) has no legacy
  // scoring fields, so passing the whole config trips a TS weak-type mismatch.
  const scoring = useMemo(
    () => resolveScoring({ scoring: config.scoring }, { mode: "completion" }),
    [config],
  );

  const hasImages = Boolean(config.before && config.after);

  const submit = () => {
    if (state.done || !hasImages) return;
    const next: State = { ...state, done: true };
    setState(next);
    persist(next);
    onSubmit({ raw: 1, max: 1, success: true, suspendData: JSON.stringify(next) });
  };

  const tryAgain = () => {
    const next: State = { position: initialPosition, done: false };
    setState(next);
    persist(next);
  };

  const ui = config.ui ?? {};
  const doneLabel = ui.doneButton ?? "Done";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";

  const pct = Math.round(state.position * 100);
  // Reveal "before" on the LEFT side: clip the after-image to the right of the seam.
  const beforeStyle: CSSProperties = {
    clipPath: `inset(0 ${100 - pct}% 0 0)`,
  };
  const seamStyle: CSSProperties = {
    left: `calc(${pct}% - 24px)`,
  };
  const seamLineStyle: CSSProperties = {
    left: `${pct}%`,
  };

  return (
    <div className="kukui-ics">
      <article className="kukui-ics__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          prompt={config.prompt ? <SafeHtml html={config.prompt} /> : undefined}
        />

        {hasImages && config.before && config.after ? (
          <div
            ref={wrapperRef}
            className="kukui-ics__stage"
            onClick={onWrapperClick}
          >
            {/* "After" image — full size, sits behind. Visible on the right of the seam. */}
            <img
              className="kukui-ics__img kukui-ics__img--after"
              src={config.after.src}
              alt={config.after.alt ?? ""}
              draggable={false}
            />
            {/* "Before" image — clipped to the area left of the seam. */}
            <img
              className="kukui-ics__img kukui-ics__img--before"
              src={config.before.src}
              alt={config.before.alt ?? ""}
              draggable={false}
              style={beforeStyle}
            />

            <div
              className="kukui-ics__seam-line"
              style={seamLineStyle}
              aria-hidden="true"
            />

            <button
              type="button"
              role="slider"
              aria-label="Comparison seam"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={`${pct}%`}
              aria-orientation="horizontal"
              className="kukui-ics__seam"
              style={seamStyle}
              disabled={state.done}
              onPointerDown={onSeamPointerDown}
              onPointerMove={onSeamPointerMove}
              onPointerUp={releaseDrag}
              onPointerCancel={releaseDrag}
              onKeyDown={onSeamKeyDown}
              onKeyUp={onSeamKeyUp}
            >
              <span className="kukui-ics__seam-grip" aria-hidden="true">
                <span className="kukui-ics__seam-arrow">‹</span>
                <span className="kukui-ics__seam-arrow">›</span>
              </span>
            </button>

            <div className="kukui-ics__caption kukui-ics__caption--before" aria-hidden="true">
              {config.before.caption ?? "Before"}
            </div>
            <div className="kukui-ics__caption kukui-ics__caption--after" aria-hidden="true">
              {config.after.caption ?? "After"}
            </div>
          </div>
        ) : (
          <div className="kukui-ics__empty" role="status">
            <strong>Add a Before and an After image to enable this activity.</strong>
            <span>Open the Editor tab and upload (or paste a URL for) each image.</span>
          </div>
        )}

        {config.prompts && config.prompts.length > 0 ? (
          <ul className="kukui-ics__prompts" aria-label="Checkpoint questions">
            {config.prompts.map((p, i) => (
              <li key={i} className="kukui-ics__prompt-item">
                <span className="kukui-ics__prompt-pos">
                  <span className="kukui-ics__sr-only">Seam position </span>
                  {Math.round(p.position * 100)}%
                </span>
                <span className="kukui-ics__prompt-text">{p.question}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="kukui-ics__actions">
          {state.done ? (
            <>
              <span className="kukui-ics__done-msg" role="status">
                Marked complete.
              </span>
              {scoring.enableRetry ? (
                <button type="button" className="kukui-ics__secondary" onClick={tryAgain}>
                  {tryAgainLabel}
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="kukui-ics__done"
              onClick={submit}
              disabled={!hasImages}
            >
              {doneLabel}
            </button>
          )}
        </div>

        {config.attribution ? (
          <ImageAttribution attribution={config.attribution} />
        ) : null}
      </article>
    </div>
  );
}

/**
 * Creative-Commons-style credit line for the comparison imagery. Always
 * rendered when `attribution` is present, regardless of license: most CC
 * variants require attribution (CC0 doesn't but a courtesy credit remains
 * good practice). License name + URL link out to the canonical license
 * page if `licenseUrl` is set.
 */
function ImageAttribution({
  attribution,
}: {
  attribution: NonNullable<ImageComparisonSliderConfig["attribution"]>;
}) {
  const { author, authorUrl, sourceUrl, license, licenseUrl } = attribution;
  return (
    <footer className="kukui-ics__attribution">
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

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (parsed && typeof parsed.position === "number") {
      return {
        position: clamp01(parsed.position),
        done: parsed.done === true,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
