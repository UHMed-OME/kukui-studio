import { useEffect, useId, useRef, type CSSProperties } from "react";
import "./KukuiLoader.css";

/**
 * The Kukui drupe silhouette, lifted verbatim from `kukui-logo.svg`. Authored
 * "dimple at top" in a ~0–64 box; centred on its centroid (~32,33) by the
 * mask transform below.
 */
const NUT_PATH =
  "M24 6 C 16 7, 8 15, 6 26 C 4 39, 12 57, 32 60 C 52 57, 60 39, 58 26 " +
  "C 56 15, 48 7, 40 6 C 37 8, 35 13, 32 14 C 29 13, 27 8, 24 6 Z";

/** Circumference of the progress arc (r = 14.5 → 2πr). */
const ARC_C = 91.1;

export type KukuiLoaderState = "loading" | "done";

export type KukuiLoaderProps = {
  /**
   * "loading" runs the indeterminate radial fill; "done" completes the disc,
   * pops the mark, and then fires `onComplete`. Default "loading".
   */
  state?: KukuiLoaderState;
  /** Status text shown beneath the mark (also the accessible label). */
  label?: string;
  /** Rendered mark width/height in px. Default 72. */
  size?: number;
  /** Fired once the completion animation finishes (only when state="done"). */
  onComplete?: () => void;
  className?: string;
  style?: CSSProperties;
};

/** Must match the completion animation duration in KukuiLoader.css (--dur). */
const COMPLETION_MS = 560;

/**
 * Brand loading graphic shared across every activity. The logo's green disc is
 * the progress surface: a radial (angular) fill sweeps it while loading, with
 * the drupe subtracted from the disc as an empty silhouette. Completion tops
 * the disc off and pops the mark.
 *
 * Reduced-motion viewers get a static three-quarter disc, no sweep.
 */
export function KukuiLoader({
  state = "loading",
  label = "Loading…",
  size = 72,
  onComplete,
  className,
  style,
}: KukuiLoaderProps) {
  // Unique mask id so several loaders on one page don't collide.
  const holeId = `kukui-loader-hole-${useId().replace(/:/g, "")}`;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (state !== "done") return;
    const t = setTimeout(() => onCompleteRef.current?.(), COMPLETION_MS);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div
      className={`kukui-loader${className ? ` ${className}` : ""}`}
      data-state={state}
      role="status"
      aria-live="polite"
      style={style}
    >
      <svg
        className="kukui-loader__mark"
        width={size}
        height={size}
        viewBox="19 19 62 62"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <mask id={holeId}>
            {/* White disc shows the fill; black nut subtracts an empty
                silhouette. Nut positioned/rotated to match the logo. */}
            <circle cx="50" cy="50" r="29" fill="#fff" />
            <path
              d={NUT_PATH}
              fill="#000"
              transform="translate(50 50) rotate(35) scale(0.8) translate(-32 -33)"
            />
          </mask>
        </defs>

        <g mask={`url(#${holeId})`}>
          {/* Faint disc the fill sweeps over. */}
          <circle
            className="kukui-loader__track"
            cx="50"
            cy="50"
            r="29"
          />
          {/* Radial progress: a thick stroke on a half-radius circle reads as
              a filled pie sector, not a thin ring. dashoffset drives how much
              of the disc is filled. */}
          <g className="kukui-loader__spin">
            <circle
              className="kukui-loader__arc"
              cx="50"
              cy="50"
              r="14.5"
              fill="none"
              strokeWidth="29"
              strokeDasharray={ARC_C}
              transform="rotate(-90 50 50)"
            />
          </g>
        </g>

        {/* Burst ring flaring outward once on completion. */}
        <circle
          className="kukui-loader__burst"
          cx="50"
          cy="50"
          r="29"
          fill="none"
          strokeWidth="2"
        />
      </svg>
      <span className="kukui-loader__label">{label}</span>
    </div>
  );
}
