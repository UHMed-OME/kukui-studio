import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Hotspot3DConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { SafeHtml } from "../../safe-html.js";
import { HotspotPin } from "../_shared/HotspotPin.js";
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

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(
      parseSuspend(suspendData) ?? { stage: "answering", selectedHotspotId: null, attempts: 0 },
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
          submitted={submitted}
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
  submitted,
  onPick,
}: {
  config: Hotspot3DConfig;
  disabled: boolean;
  selectedHotspotId: string | null;
  submitted: boolean;
  onPick: (id: string) => void;
}) {
  // Probe both webgl and webgl2 — Safari with strict privacy settings
  // can return null for "webgl" but still have webgl2 available, and
  // probing only the legacy context falls into the text fallback for a
  // non-trivial Safari audience that otherwise renders fine.
  const hasWebGL =
    typeof window !== "undefined" &&
    typeof window.WebGLRenderingContext !== "undefined" &&
    (() => {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    })();

  if (!hasWebGL) {
    return (
      <div className="kukui-h3d__no-webgl" role="img" aria-label="3D model placeholder">
        3D scene unavailable in this environment. Use the keyboard list below.
      </div>
    );
  }

  const showMarkers = config.behaviour?.showHotspotMarkers ?? true;
  const allowOrbit = config.behaviour?.allowOrbit ?? true;
  const cameraCfg = config.camera ?? {};
  // The model is the only meaningful occluder. Pins raycast against it
  // each frame to decide whether to render the "behind" style.
  const modelRef = useRef<THREE.Object3D | null>(null);

  // Initial camera position: prefer an explicit camera.initialPosition
  // (added when the author clicks "Save current view" in the editor),
  // otherwise fall back to the legacy "distance only" path.
  const initialPos: [number, number, number] = cameraCfg.initialPosition
    ? [
        cameraCfg.initialPosition.x,
        cameraCfg.initialPosition.y,
        cameraCfg.initialPosition.z,
      ]
    : [0, 0.05, cameraCfg.initialDistance ?? 0.6];

  return (
    <div className="kukui-h3d__canvas-wrap">
      <Canvas camera={{ position: initialPos, fov: 35 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={1.0} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />
        <Suspense fallback={null}>
          <Model src={config.model.src} scale={config.model.scale ?? 1} sceneRef={modelRef} />
        </Suspense>
        {showMarkers
          ? config.hotspots.map((h, i) => {
              const isSelected = selectedHotspotId === h.id;
              const kind = submitted
                ? isSelected
                  ? h.correct
                    ? "correct"
                    : "incorrect"
                  : h.correct
                    ? "reveal"
                    : "default"
                : isSelected
                  ? "selected"
                  : "default";
              return (
                <HotspotPin
                  key={h.id}
                  position={h.position}
                  number={i + 1}
                  label={h.label ?? h.id}
                  kind={kind}
                  disabled={disabled}
                  onClick={() => onPick(h.id)}
                  occluders={[modelRef.current]}
                  ariaLabel={`Hotspot ${i + 1}: ${h.label ?? h.id}`}
                />
              );
            })
          : null}
        {allowOrbit ? (
          <OrbitControls
            enablePan={false}
            target={[
              cameraCfg.target?.x ?? 0,
              cameraCfg.target?.y ?? 0,
              cameraCfg.target?.z ?? 0,
            ]}
            minDistance={cameraCfg.minDistance}
            maxDistance={cameraCfg.maxDistance}
          />
        ) : null}
      </Canvas>
    </div>
  );
}

function Model({
  src,
  scale,
  sceneRef,
}: {
  src: string;
  scale: number;
  sceneRef?: React.MutableRefObject<THREE.Object3D | null>;
}) {
  const { scene } = useGLTF(src);
  useEffect(() => {
    if (sceneRef) sceneRef.current = scene;
    return () => {
      if (sceneRef) sceneRef.current = null;
    };
  }, [scene, sceneRef]);
  return <primitive object={scene} scale={scale} />;
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
