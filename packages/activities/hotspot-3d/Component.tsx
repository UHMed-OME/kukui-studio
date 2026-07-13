import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Hotspot3DConfig } from "./schema.js";
import type { ActivityProps } from "@kukui/core/types";
import { ActivityHeader, SafeHtml } from "@kukui/core";
import { bandMessage, percentage, resolveScoring } from "@kukui/core/scoring";
import { HotspotPin } from "@kukui/core/components/_shared/HotspotPin";
import {
  GLBErrorBoundary,
  GLBLoadingOverlay,
  useCompressedGLTF,
} from "@kukui/core/components/_shared/glb-loader";
import {
  SketchfabViewer,
  type SketchfabHotspot,
} from "@kukui/core/components/_shared/SketchfabViewer";
import "./Component.css";

/**
 * Lighting presets selectable per-activity via `config.lighting.preset`.
 * Maps to drei's <Environment preset> values. "studio" is the default
 * — neutral white-grey reflections, works for any subject. Authors can
 * pick "warehouse" for industrial, "park"/"forest" for outdoor warmth,
 * "lobby" for soft tinted, or "sunset" for dramatic.
 */
const LIGHTING_PRESETS = ["studio", "warehouse", "park", "forest", "lobby", "sunset"] as const;
type LightingPreset = (typeof LIGHTING_PRESETS)[number];
const DEFAULT_PRESET: LightingPreset = "studio";

/**
 * Procedural light rig per preset. We deliberately don't fetch drei's
 * HDRI environments (see the comment inside <Canvas>), so each preset
 * maps to an ambient + key/fill directional combination that
 * approximates the named environment's mood: intensity for brightness,
 * color temperature for warmth. "studio" matches the original
 * hardcoded rig exactly.
 */
const LIGHT_RIGS: Record<
  LightingPreset,
  {
    ambient: { intensity: number; color: string };
    key: { intensity: number; color: string };
    fill: { intensity: number; color: string };
  }
> = {
  studio: {
    ambient: { intensity: 0.6, color: "#ffffff" },
    key: { intensity: 0.9, color: "#ffffff" },
    fill: { intensity: 0.35, color: "#ffffff" },
  },
  warehouse: {
    ambient: { intensity: 0.45, color: "#dfe4ea" },
    key: { intensity: 0.75, color: "#eef1f5" },
    fill: { intensity: 0.3, color: "#c9d2dc" },
  },
  park: {
    ambient: { intensity: 0.7, color: "#eaf3e0" },
    key: { intensity: 1.0, color: "#fff6df" },
    fill: { intensity: 0.4, color: "#cfe3f5" },
  },
  forest: {
    ambient: { intensity: 0.5, color: "#dcead2" },
    key: { intensity: 0.7, color: "#f2f7da" },
    fill: { intensity: 0.35, color: "#b9d4ad" },
  },
  lobby: {
    ambient: { intensity: 0.65, color: "#f5ecdf" },
    key: { intensity: 0.8, color: "#ffeed6" },
    fill: { intensity: 0.4, color: "#e8dcc8" },
  },
  sunset: {
    ambient: { intensity: 0.4, color: "#f3d4b8" },
    key: { intensity: 1.1, color: "#ffc488" },
    fill: { intensity: 0.25, color: "#9fb4d8" },
  },
};

type Stage = "answering" | "submitted";

type State = {
  stage: Stage;
  selectedHotspotId: string | null;
  attempts: number;
};

/**
 * Which render path the model config resolves to. Exported for tests:
 * JSDOM can't reach the 3D branches (no WebGL), so the precedence
 * decision is a pure function verified directly.
 *
 * `src` wins over `sketchfabUid` when both are set: SCORM export
 * bundles the downloaded GLB at `model.src` (sketchfabMode "import"),
 * and the Sketchfab iframe path needs live network access to
 * sketchfab.com, which offline LMS packages don't have. Branching on
 * the UID first would break every exported package that still carries
 * the UID alongside the bundled file.
 */
export function resolveModelSource(
  model: Hotspot3DConfig["model"],
): { kind: "glb"; src: string } | { kind: "sketchfab"; uid: string } | { kind: "none" } {
  if (model.src) return { kind: "glb", src: model.src };
  if (model.sketchfabUid) return { kind: "sketchfab", uid: model.sketchfabUid };
  return { kind: "none" };
}

/**
 * Module-level lazily-computed WebGL support probe. Creating a canvas
 * and requesting a context on every render leaked a WebGL context per
 * render (browsers cap live contexts at ~16 and drop the oldest when
 * the cap is hit, including the one the activity is using).
 * Probe once, cache the answer for the life of the page.
 */
let webglSupport: boolean | null = null;
function hasWebGLSupport(): boolean {
  if (webglSupport === null) {
    webglSupport =
      typeof window !== "undefined" &&
      typeof window.WebGLRenderingContext !== "undefined" &&
      (() => {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl2") || c.getContext("webgl"));
      })();
  }
  return webglSupport;
}

/**
 * 3D Hotspot Identification.
 *
 * The Canvas-based 3D scene renders only when WebGL is available; in JSDOM
 * tests it falls through to a placeholder. The keyboard / screen-reader
 * fallback list is always present and is functionally equivalent to clicking
 * a hotspot in 3D — every test exercise goes through it.
 */
export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<Hotspot3DConfig>) {
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

  // Retry / show-solution / bands come from the resolved scoring view:
  // Studio's migrator strips behaviour.enableRetry into scoring.enableRetry,
  // so reading config.behaviour directly is a dead path for re-saved
  // content. resolveScoring still honors legacy behaviour blocks in old
  // fixtures.
  const scoring = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);

  const ui = config.ui ?? {};
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";
  const checkLabel = "Check";

  const selectedHotspot = state.selectedHotspotId
    ? config.hotspots.find((h) => h.id === state.selectedHotspotId)
    : null;

  const rawScore = submitted && selectedHotspot?.correct ? 1 : 0;
  const banner = submitted ? bandMessage(scoring.bands, percentage({ raw: rawScore, max: 1 })) : null;

  return (
    <div className="kukui-h3d">
      <article className="kukui-h3d__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "minimal"}
          prompt={config.prompt ? <SafeHtml html={config.prompt} /> : undefined}
        />

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

        {/* Post-submit the row never empties: the score line always renders,
            so turning retry off doesn't collapse the row (layout-stable). */}
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
          ) : (
            <>
              <output className="kukui-h3d__score">
                {rawScore} / 1
                {banner ? <span className="kukui-h3d__band"> · {banner}</span> : null}
              </output>
              {scoring.enableRetry ? (
                <button type="button" className="kukui-h3d__secondary" onClick={tryAgain}>
                  {tryAgainLabel}
                </button>
              ) : null}
            </>
          )}
        </div>

        {config.model.attribution ? (
          <ModelAttribution attribution={config.model.attribution} />
        ) : null}
      </article>
    </div>
  );
}

/**
 * Creative-Commons-style credit line for the 3D model. Always rendered
 * when `model.attribution` is present, regardless of license — most CC
 * variants require attribution (CC0 doesn't but a courtesy credit
 * remains good practice). License name + URL link out to the canonical
 * license page if `licenseUrl` is set.
 */
function ModelAttribution({
  attribution,
}: {
  attribution: NonNullable<Hotspot3DConfig["model"]["attribution"]>;
}) {
  const { author, authorUrl, sourceUrl, license, licenseUrl } = attribution;
  return (
    <footer className="kukui-h3d__attribution">
      <span>Model by </span>
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
  // All hooks live above the conditional early returns below — switching
  // between the no-WebGL / Sketchfab / GLB render paths must never change
  // the hook count (Rules of Hooks).
  //
  // The model is the only meaningful occluder. Pins raycast against it
  // each frame to decide whether to render the "behind" style. Held in
  // state (not a ref): passing `ref.current` into the pins' `occluders`
  // prop captured `null` on the first render and nothing re-rendered
  // when the GLB finished loading, so occlusion stayed inert until an
  // unrelated re-render. State makes the load trigger the re-render.
  const [modelObj, setModelObj] = useState<THREE.Object3D | null>(null);

  // Bumping this remounts the <Canvas>, resetting camera + orbit
  // controls to their initial framing. Cheap: the GLB stays in drei's
  // loader cache, so a remount re-frames without re-downloading.
  const [viewNonce, setViewNonce] = useState(0);

  // Probe both webgl and webgl2 — Safari with strict privacy settings
  // can return null for "webgl" but still have webgl2 available, and
  // probing only the legacy context falls into the text fallback for a
  // non-trivial Safari audience that otherwise renders fine.
  const hasWebGL = hasWebGLSupport();

  const aspect = config.behaviour?.aspectRatio ?? "16/10";
  const aspectCssMap: Record<string, string> = {
    "16/10": "16 / 10",
    "16/9": "16 / 9",
    "4/3": "4 / 3",
    "1/1": "1 / 1",
  };
  const viewportStyle = { aspectRatio: aspectCssMap[aspect] };

  if (!hasWebGL) {
    return (
      <div
        className="kukui-h3d__no-webgl"
        role="img"
        aria-label="3D model placeholder"
        style={viewportStyle}
      >
        3D scene unavailable in this environment. Use the keyboard list below.
      </div>
    );
  }

  // Sketchfab embed path: when the author chose a Sketchfab UID and no
  // bundled GLB exists, we embed Sketchfab's viewer iframe. The hotspot
  // overlay (numbered HTML pins) is rendered on top by SketchfabViewer
  // using projected screen coordinates. `model.src` takes precedence
  // (see resolveModelSource): SCORM export bundles the GLB at src and
  // the iframe would 404 offline.
  const modelSource = resolveModelSource(config.model);
  if (modelSource.kind === "sketchfab") {
    const sfHotspots: SketchfabHotspot[] = config.hotspots.map((h, i) => {
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
      return {
        id: h.id,
        position: h.position,
        label: h.label ?? h.id,
        number: i + 1,
        kind,
      };
    });
    return (
      <div className="kukui-h3d__canvas-wrap" style={viewportStyle}>
        <SketchfabViewer
          uid={modelSource.uid}
          hotspots={sfHotspots}
          onPickHotspot={(id) => {
            if (!disabled) onPick(id);
          }}
          showMarkers={config.behaviour?.showHotspotMarkers ?? true}
        />
      </div>
    );
  }

  const showMarkers = config.behaviour?.showHotspotMarkers ?? true;
  const allowOrbit = config.behaviour?.allowOrbit ?? true;
  const cameraCfg = config.camera ?? {};
  const modelScale = config.model.scale ?? 1;
  const lightingPreset: LightingPreset =
    config.lighting?.preset && LIGHTING_PRESETS.includes(config.lighting.preset as LightingPreset)
      ? (config.lighting.preset as LightingPreset)
      : DEFAULT_PRESET;
  const rig = LIGHT_RIGS[lightingPreset];

  // Camera: honor the author's pinned view if present. A full
  // `initialPosition` snapshot wins; otherwise `initialDistance` places
  // the camera that far from the target along a pleasant three-quarter
  // viewing direction. With neither, FrameToModel below auto-fits to
  // the model's bounding box on first frame (placeholder position keeps
  // R3F happy until the fit lands).
  const hasPinnedView = Boolean(cameraCfg.initialPosition) || Boolean(cameraCfg.initialDistance);
  const target = new THREE.Vector3(
    cameraCfg.target?.x ?? 0,
    cameraCfg.target?.y ?? 0,
    cameraCfg.target?.z ?? 0,
  );
  let initialPos: [number, number, number] = [0, 0, 1];
  if (cameraCfg.initialPosition) {
    initialPos = [
      cameraCfg.initialPosition.x,
      cameraCfg.initialPosition.y,
      cameraCfg.initialPosition.z,
    ];
  } else if (cameraCfg.initialDistance) {
    const p = new THREE.Vector3(0.4, 0.25, 1)
      .normalize()
      .multiplyScalar(cameraCfg.initialDistance)
      .add(target);
    initialPos = [p.x, p.y, p.z];
  }

  return (
    <div className="kukui-h3d__canvas-wrap" style={viewportStyle}>
      <GLBErrorBoundary
        fallback={
          <div className="kukui-glb-error" role="alert">
            <strong className="kukui-glb-error__title">3D model couldn't load</strong>
            <p className="kukui-glb-error__hint">
              The file may be missing, blocked by CORS, or use an unsupported
              compression format. Use the keyboard list below to answer.
            </p>
          </div>
        }
      >
        <Canvas
          key={viewNonce}
          camera={{ position: initialPos, fov: 45, near: 0.001, far: 1000 }}
          gl={{ toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
        >
          {/* No drei <Environment preset> — that fetches an HDR from
              raw.githack.com which fails inside LMS networks that block
              external CDNs, and trips strict CSPs (CSP saw it before we
              did). Use three procedural lights instead — flatter shading
              than IBL, but the activity ships fully self-contained. The
              author's `lighting.preset` picks a LIGHT_RIGS entry above.
              To restore IBL later, bundle an HDR file in the SCORM zip
              and pass it via `files=` on Environment. */}
          <ambientLight intensity={rig.ambient.intensity} color={rig.ambient.color} />
          <directionalLight
            position={[3, 5, 4]}
            intensity={rig.key.intensity}
            color={rig.key.color}
            castShadow={false}
          />
          <directionalLight
            position={[-3, 2, -4]}
            intensity={rig.fill.intensity}
            color={rig.fill.color}
            castShadow={false}
          />
          <Suspense fallback={null}>
            {modelSource.kind === "glb" ? (
              <Model src={modelSource.src} scale={modelScale} onScene={setModelObj} />
            ) : null}
          </Suspense>
          {/* Pins live inside a scaled group so positions are interpreted
              in model-local space — matches the editor's storage format. */}
          {showMarkers ? (
            <group scale={modelScale}>
              {config.hotspots.map((h, i) => {
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
                    occluders={[modelObj]}
                    ariaLabel={`Hotspot ${i + 1}: ${h.label ?? h.id}`}
                  />
                );
              })}
            </group>
          ) : null}
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
              makeDefault
            />
          ) : null}
          {!hasPinnedView ? <FrameToModel model={modelObj} /> : null}
        </Canvas>
        <GLBLoadingOverlay />
        {/* Reset view: remounts the Canvas (key above), restoring the
            initial camera framing. Sits over the fixed-dark 3D canvas,
            not a themed surface, so the raw dark scrim + white text
            here are the sanctioned canvas-overlay exception. */}
        {allowOrbit ? (
          <button
            type="button"
            className="kukui-h3d__reset-view"
            onClick={() => setViewNonce((n) => n + 1)}
          >
            {config.ui?.resetViewButton ?? "Reset view"}
          </button>
        ) : null}
      </GLBErrorBoundary>
    </div>
  );
}

/**
 * One-shot bounding-box fit. After the GLB loads, frames the camera
 * around the model with comfortable headroom and points the orbit
 * controls at its center. Subsequent frames noop so the learner can
 * orbit freely after the initial fit.
 */
function FrameToModel({ model }: { model: THREE.Object3D | null }) {
  const { camera, controls } = useThree() as {
    camera: THREE.PerspectiveCamera;
    controls: { target: THREE.Vector3; update?: () => void } | null;
  };
  const framedRef = useRef(false);
  useFrame(() => {
    if (framedRef.current) return;
    if (!model) return;
    model.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) return;
    const fovRad = (camera.fov * Math.PI) / 180;
    const distance = (maxDim / 2 / Math.tan(fovRad / 2)) * 1.6;
    camera.position.set(
      center.x + distance * 0.4,
      center.y + distance * 0.25,
      center.z + distance,
    );
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    if (controls?.target) {
      controls.target.copy(center);
      controls.update?.();
    }
    framedRef.current = true;
  });
  return null;
}

function Model({
  src,
  scale,
  onScene,
}: {
  src: string;
  scale: number;
  /** Reports the loaded scene up so the host can re-render (pins need
   * a real occluder object, not a stale ref snapshot). */
  onScene?: (scene: THREE.Object3D | null) => void;
}) {
  const { scene } = useCompressedGLTF(src);
  useEffect(() => {
    onScene?.(scene);
    return () => {
      onScene?.(null);
    };
  }, [scene, onScene]);
  return <primitive object={scene} scale={scale} />;
}

function parseSuspend(s: string | undefined, config: Hotspot3DConfig): State | null {
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
