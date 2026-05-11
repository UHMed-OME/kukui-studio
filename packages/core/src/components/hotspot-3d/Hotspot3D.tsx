import { Suspense, useEffect, useId, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
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
  const cameraCfg = config.camera ?? {};

  return (
    <div className="kukui-h3d__canvas-wrap">
      <Canvas camera={{ position: [0, 0.05, cameraCfg.initialDistance ?? 0.6], fov: 35 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={1.0} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />
        <Suspense fallback={null}>
          <Model src={config.model.src} scale={config.model.scale ?? 1} />
        </Suspense>
        {showMarkers
          ? config.hotspots.map((h, i) => (
              <HotspotMarker
                key={h.id}
                index={i + 1}
                hotspot={h}
                isSelected={selectedHotspotId === h.id}
                disabled={disabled}
                onPick={onPick}
              />
            ))
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

function Model({ src, scale }: { src: string; scale: number }) {
  const { scene } = useGLTF(src);
  return <primitive object={scene} scale={scale} />;
}

function HotspotMarker({
  hotspot,
  index,
  isSelected,
  disabled,
  onPick,
}: {
  hotspot: Hotspot3DConfig["hotspots"][number];
  index: number;
  isSelected: boolean;
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <group position={[hotspot.position.x, hotspot.position.y, hotspot.position.z]}>
      <mesh
        onClick={(ev) => {
          ev.stopPropagation();
          if (!disabled) onPick(hotspot.id);
        }}
      >
        <sphereGeometry args={[hotspot.radius, 24, 24]} />
        <meshStandardMaterial
          color={isSelected ? tokens.primary : tokens.primaryHover}
          transparent
          opacity={isSelected ? 0.85 : 0.55}
          emissive={isSelected ? tokens.primary : "#000000"}
          emissiveIntensity={isSelected ? 0.4 : 0}
        />
      </mesh>
      <Html
        center
        distanceFactor={8}
        occlude={false}
        style={{ pointerEvents: "none" }}
      >
        <div
          aria-hidden="true"
          style={{
            background: isSelected ? tokens.primary : "rgba(28, 30, 32, 0.85)",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: 12,
            lineHeight: 1,
            padding: "4px 8px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            border: `2px solid ${isSelected ? "#ffffff" : tokens.primaryHover}`,
            transform: "translateY(-150%)",
          }}
        >
          {index}. {hotspot.label ?? hotspot.id}
        </div>
      </Html>
    </group>
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
