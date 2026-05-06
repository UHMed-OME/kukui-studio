import { Suspense, useEffect, useId, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Gltf, OrbitControls } from "@react-three/drei";
import type { Hotspot3DConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { SafeHtml } from "../../safe-html.js";
import { tokens } from "../../tokens.js";
import "./Hotspot3D.css";

type Stage = "answering" | "submitted";

type State = {
  stage: Stage;
  selectedHotspotId: string | null;
  attempts: number;
};

/**
 * 3D Hotspot Identification.
 *
 * The Canvas-based 3D scene renders only when WebGL is available; in JSDOM
 * tests it falls through to a placeholder. The keyboard / screen-reader
 * fallback list is always present and is functionally equivalent to clicking
 * a hotspot in 3D — every test exercise goes through it.
 */
export function Hotspot3D({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<Hotspot3DConfig>) {
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

  // Selection: clicking a hotspot (3D or fallback list) sets selection but
  // does NOT finalize. Learner reviews the choice, then presses Check. This
  // matches MultipleChoice's flow and prevents accidental Tab+Space submits.
  const selectHotspot = (hotspotId: string) => {
    if (submitted) return;
    const hot = config.hotspots.find((h) => h.id === hotspotId);
    if (!hot) return;
    setState((s) => ({ ...s, selectedHotspotId: hotspotId }));
  };

  const submit = () => {
    if (submitted || state.selectedHotspotId === null) return;
    const hot = config.hotspots.find((h) => h.id === state.selectedHotspotId);
    if (!hot) return;
    const success = hot.correct === true;
    const next: State = {
      stage: "submitted",
      selectedHotspotId: state.selectedHotspotId,
      attempts: state.attempts + 1,
    };
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

  const ui = config.ui ?? {};
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";
  const checkLabel = "Check";

  const selectedHotspot = state.selectedHotspotId
    ? config.hotspots.find((h) => h.id === state.selectedHotspotId)
    : null;

  return (
    <div className="kukui-h3d">
      <article className="kukui-h3d__card" aria-labelledby={headingId}>
        <HeadingTag className="kukui-h3d__title" id={headingId}>
          {config.title}
        </HeadingTag>
        <SafeHtml className="kukui-h3d__prompt" html={config.prompt} />

        <Hotspot3DScene
          config={config}
          disabled={submitted}
          selectedHotspotId={state.selectedHotspotId}
          onPick={selectHotspot}
        />

        <fieldset className="kukui-h3d__fallback" disabled={submitted}>
          <legend className="kukui-h3d__fallback-legend">
            Select a part (keyboard / screen-reader equivalent)
          </legend>
          <ul className="kukui-h3d__fallback-list">
            {config.hotspots.map((h) => {
              const isSelected = state.selectedHotspotId === h.id;
              const isCorrect = submitted && isSelected && h.correct;
              const isWrong = submitted && isSelected && !h.correct;
              const reveal = submitted && !isSelected && h.correct;
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className={[
                      "kukui-h3d__fallback-button",
                      isSelected ? "is-selected" : "",
                      isCorrect ? "is-correct" : "",
                      isWrong ? "is-incorrect" : "",
                      reveal ? "is-reveal" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => selectHotspot(h.id)}
                  >
                    <span>{h.label ?? h.id}</span>
                    <span className="kukui-h3d__fallback-icon" aria-hidden="true">
                      {isCorrect ? "✓" : isWrong ? "✗" : reveal ? "○" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div
          className={["kukui-h3d__feedback", submitted ? "is-visible" : ""]
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
                  : `The correct answer was “${correctHotspot?.label ?? correctHotspot?.id ?? ""}”.`)}
            </>
          ) : null}
        </div>

        <div className="kukui-h3d__actions">
          {!submitted ? (
            <button
              type="button"
              className="kukui-h3d__primary"
              disabled={state.selectedHotspotId === null}
              onClick={submit}
            >
              {checkLabel}
            </button>
          ) : null}
          {submitted && config.behaviour?.enableRetry ? (
            <button type="button" className="kukui-h3d__secondary" onClick={tryAgain}>
              {tryAgainLabel}
            </button>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function Hotspot3DScene({
  config,
  disabled,
  selectedHotspotId,
  onPick,
}: {
  config: Hotspot3DConfig;
  disabled: boolean;
  selectedHotspotId: string | null;
  onPick: (id: string) => void;
}) {
  const hasWebGL =
    typeof window !== "undefined" &&
    typeof window.WebGLRenderingContext !== "undefined" &&
    !!document.createElement("canvas").getContext("webgl");

  if (!hasWebGL) {
    return (
      <div className="kukui-h3d__no-webgl" role="img" aria-label="3D model placeholder">
        3D scene unavailable in this environment. Use the keyboard list below.
      </div>
    );
  }

  const showMarkers = config.behaviour?.showHotspotMarkers ?? true;
  const allowOrbit = config.behaviour?.allowOrbit ?? true;
  const camera = config.camera ?? {};

  return (
    <div className="kukui-h3d__canvas-wrap">
      <Canvas camera={{ position: [0, 0, camera.initialDistance ?? 3] }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={0.9} />
        <Suspense fallback={null}>
          <Gltf src={config.model.src} scale={config.model.scale ?? 1} />
        </Suspense>
        {showMarkers
          ? config.hotspots.map((h) => (
              <mesh
                key={h.id}
                position={[h.position.x, h.position.y, h.position.z]}
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (!disabled) onPick(h.id);
                }}
              >
                <sphereGeometry args={[h.radius, 16, 16]} />
                <meshStandardMaterial
                  color={selectedHotspotId === h.id ? tokens.primary : tokens.primaryHover}
                  transparent
                  opacity={0.45}
                />
              </mesh>
            ))
          : null}
        {allowOrbit ? <OrbitControls enablePan={false} /> : null}
      </Canvas>
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
