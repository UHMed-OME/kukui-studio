import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Gltf, OrbitControls } from "@react-three/drei";
import type { VirtualTourConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { SafeHtml } from "../../safe-html.js";
import { tokens } from "../../tokens.js";
import "./VirtualTour.css";

type Stage = "exploring" | "submitted";

type State = {
  stage: Stage;
  visited: string[];
  openOverlayId: string | null;
};

/**
 * Virtual Environment Tour.
 *
 * 3D scene + clickable / proximity overlays. The keyboard fallback list of
 * overlay titles is the primary accessible path; visiting from there marks
 * the overlay as visited and opens its content panel exactly the same as a
 * 3D click would.
 */
export function VirtualTour({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<VirtualTourConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();
  const overlayCloseRef = useRef<HTMLButtonElement | null>(null);
  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData) ?? { stage: "exploring", visited: [], openOverlayId: null },
  );

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const ui = config.ui ?? {};
  const completionMode = config.completion?.mode ?? "manual";
  const requiredIds = useMemo(
    () => new Set(config.completion?.requiredOverlayIds ?? config.overlays.map((o) => o.id)),
    [config.completion?.requiredOverlayIds, config.overlays],
  );

  const visit = (overlayId: string) => {
    if (state.stage === "submitted") return;
    setState((s) => {
      const visited = s.visited.includes(overlayId) ? s.visited : [...s.visited, overlayId];
      return { ...s, visited, openOverlayId: overlayId };
    });
  };

  const closeOverlay = () => setState((s) => ({ ...s, openOverlayId: null }));

  // Focus the close button on overlay open and wire Escape-to-close.
  useEffect(() => {
    if (state.openOverlayId === null) return;
    overlayCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.openOverlayId]);

  const submit = () => {
    if (state.stage === "submitted") return;
    const visitedRequired = state.visited.filter((id) => requiredIds.has(id)).length;
    const max = requiredIds.size;
    const next: State = { ...state, stage: "submitted", openOverlayId: null };
    setState(next);
    onSubmit({
      raw: visitedRequired,
      max,
      success: visitedRequired === max && max > 0,
      suspendData: JSON.stringify(next),
    });
  };

  // Auto-submit for visitAll completion when every required overlay has been visited.
  useEffect(() => {
    if (state.stage !== "exploring" || completionMode !== "visitAll") return;
    const visitedAll = [...requiredIds].every((id) => state.visited.includes(id));
    if (visitedAll) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.visited, completionMode, requiredIds]);

  const submitted = state.stage === "submitted";
  const openOverlay =
    state.openOverlayId !== null
      ? config.overlays.find((o) => o.id === state.openOverlayId) ?? null
      : null;

  return (
    <div className="kukui-vt">
      <article className="kukui-vt__card" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-vt__title">
          {config.title}
        </HeadingTag>

        <VirtualTourScene config={config} disabled={submitted} onVisit={visit} />

        <fieldset className="kukui-vt__fallback" disabled={submitted}>
          <legend className="kukui-vt__fallback-legend">Points of interest</legend>
          <ul className="kukui-vt__fallback-list">
            {config.overlays.map((o) => {
              const visited = state.visited.includes(o.id);
              const required = requiredIds.has(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className={[
                      "kukui-vt__fallback-button",
                      visited ? "is-visited" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => visit(o.id)}
                  >
                    <span>{o.title ?? o.id}</span>
                    <span className="kukui-vt__fallback-icon" aria-hidden="true">
                      {visited ? "✓" : required ? "•" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>

        {openOverlay ? (
          <div className="kukui-vt__overlay" role="dialog" aria-modal="false" aria-labelledby="vt-overlay-title">
            <header className="kukui-vt__overlay-header">
              <h2 id="vt-overlay-title" className="kukui-vt__overlay-title">
                {openOverlay.title ?? openOverlay.id}
              </h2>
              <button
                ref={overlayCloseRef}
                type="button"
                className="kukui-vt__overlay-close"
                onClick={closeOverlay}
                aria-label={ui.closeOverlayButton ?? "Close overlay"}
              >
                ×
              </button>
            </header>
            <div className="kukui-vt__overlay-body">
              {openOverlay.content.map((c, i) => {
                if (c.type === "text") {
                  return <SafeHtml key={i} html={c.html} />;
                }
                if (c.type === "image") {
                  return (
                    <figure key={i}>
                      <img src={c.src} alt={c.alt ?? ""} className="kukui-vt__overlay-img" />
                      {c.caption ? (
                        <figcaption className="kukui-vt__overlay-caption">{c.caption}</figcaption>
                      ) : null}
                    </figure>
                  );
                }
                // audio
                return (
                  <figure key={i}>
                    <audio src={c.src} controls autoPlay={c.autoplay} loop={c.loop} />
                    {c.caption ? (
                      <figcaption className="kukui-vt__overlay-caption">{c.caption}</figcaption>
                    ) : null}
                  </figure>
                );
              })}
            </div>
          </div>
        ) : null}

        <p
          className="kukui-vt__progress"
          aria-live="polite"
        >
          Visited {state.visited.filter((id) => requiredIds.has(id)).length} of {requiredIds.size}.
        </p>

        <div className="kukui-vt__actions">
          {!submitted && completionMode === "manual" ? (
            <button type="button" className="kukui-vt__primary" onClick={submit}>
              {ui.doneButton ?? "Done"}
            </button>
          ) : null}
          {submitted ? (
            <p className="kukui-vt__done">Tour complete.</p>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function VirtualTourScene({
  config,
  disabled,
  onVisit,
}: {
  config: VirtualTourConfig;
  disabled: boolean;
  onVisit: (id: string) => void;
}) {
  const hasWebGL =
    typeof window !== "undefined" &&
    typeof window.WebGLRenderingContext !== "undefined" &&
    !!document.createElement("canvas").getContext("webgl");

  if (!hasWebGL) {
    return (
      <div className="kukui-vt__no-webgl" role="img" aria-label="3D scene placeholder">
        3D scene unavailable in this environment. Use the points-of-interest list below.
      </div>
    );
  }

  return (
    <div className="kukui-vt__canvas-wrap">
      <Canvas camera={{ position: [0, 1.6, 3] }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <Suspense fallback={null}>
          <Gltf src={config.scene.src} />
        </Suspense>
        {config.overlays.map((o) => (
          <mesh
            key={o.id}
            position={[o.position.x, o.position.y, o.position.z]}
            onClick={(ev) => {
              ev.stopPropagation();
              if (!disabled) onVisit(o.id);
            }}
          >
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial
              color={tokens.primary}
              emissive={tokens.primary}
              emissiveIntensity={0.4}
            />
          </mesh>
        ))}
        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  );
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (parsed && Array.isArray(parsed.visited)) {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "exploring",
        visited: parsed.visited.filter((s): s is string => typeof s === "string"),
        openOverlayId: typeof parsed.openOverlayId === "string" ? parsed.openOverlayId : null,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
