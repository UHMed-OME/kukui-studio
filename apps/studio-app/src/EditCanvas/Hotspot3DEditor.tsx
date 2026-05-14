import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Hotspot3DConfig } from "@kukui/schemas";
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

const LIGHTING_PRESETS = ["studio", "warehouse", "park", "forest", "lobby", "sunset"] as const;
type LightingPreset = (typeof LIGHTING_PRESETS)[number];
const DEFAULT_PRESET: LightingPreset = "studio";

type Hotspot = Hotspot3DConfig["hotspots"][number];

const roundCoord = (n: number) => Math.round(n * 1000) / 1000;
const r3 = (v: { x: number; y: number; z: number }) => ({
  x: roundCoord(v.x),
  y: roundCoord(v.y),
  z: roundCoord(v.z),
});

const newHotspotId = (existing: string[]): string => {
  let i = existing.length + 1;
  while (existing.includes(`h-${i}`)) i += 1;
  return `h-${i}`;
};

function Hotspot3DEditorEmpty() {
  return (
    <div className="ks-edit-empty">
      <p style={{ margin: "0 0 8px", fontWeight: 700, color: "var(--color-text-primary)" }}>
        Set a model first.
      </p>
      <p style={{ margin: 0 }}>
        Enter a GLB URL or a Sketchfab UID in the <strong>Model</strong> section of the
        form on the left, then this canvas will load so you can place hotspots.
      </p>
    </div>
  );
}

/**
 * Visual editor for 3D Hotspot Identification.
 *
 * Hotspots render as numbered HTML pins inside a `<group scale>` that
 * mirrors the model's transform, so positions stored in config are in
 * **model-local space** — the same space the runtime uses. Clicking a
 * pin selects it; clicking the model relocates the selected pin,
 * otherwise drops a new one. Click empty canvas to deselect.
 *
 * Pin drag: pointerdown on the selected pin starts a drag; pointer
 * moves over the model raycast against `modelRef.current` and update
 * the pin's position live. Pointerup commits.
 *
 * Camera framing: when the author hasn't pinned a view yet
 * (`camera.initialPosition` unset), we auto-fit the camera to the
 * model's bounding box on first load. "Save current view" snapshots
 * the live OrbitControls state so the runtime opens identically.
 */
/**
 * Outer guard: EditCanvas hands us the raw form value before Zod parses
 * it, so any mid-edit state where `model` is missing or empty (Reset
 * all, src cleared but Sketchfab UID not yet entered, legacy draft from
 * before `model` was required) reaches this component. Render a
 * placeholder so the inner editor — which assumes a non-empty model and
 * relies on react-three-fiber hooks that can't be conditionally called —
 * doesn't mount until the form is in a usable state.
 */
export function Hotspot3DEditor(props: {
  config: Hotspot3DConfig;
  onChange: (next: Hotspot3DConfig) => void;
}) {
  const model = props.config.model;
  if (!model || (!model.src && !model.sketchfabUid)) {
    return <Hotspot3DEditorEmpty />;
  }
  return <Hotspot3DEditorInner {...props} />;
}

function Hotspot3DEditorInner({
  config,
  onChange,
}: {
  config: Hotspot3DConfig;
  onChange: (next: Hotspot3DConfig) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const hotspots = config.hotspots ?? [];
  const selectedHotspot = useMemo(
    () => hotspots.find((h) => h.id === selectedId) ?? null,
    [hotspots, selectedId],
  );
  const modelScale = config.model.scale ?? 1;

  const writeHotspots = useCallback(
    (next: Hotspot[]) => {
      onChange({ ...config, hotspots: next });
    },
    [config, onChange],
  );

  // Refs shared between Canvas-internal probes and the side-panel
  // button. The probe writes the live camera + canvas + raycaster
  // state every frame; outside-canvas handlers read on demand.
  const modelRef = useRef<THREE.Object3D | null>(null);
  const cameraStateRef = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  }>({ position: new THREE.Vector3(), target: new THREE.Vector3() });
  const canvasRef = useRef<HTMLDivElement>(null);
  const r3fRef = useRef<{
    camera: THREE.Camera | null;
    gl: THREE.WebGLRenderer | null;
  }>({ camera: null, gl: null });
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());

  const handleModelClick = (point: { x: number; y: number; z: number }) => {
    // Clicking the model while a pin is selected deselects — never
    // repositions. Repositioning is drag-only so a stray click can't
    // teleport a pin.
    if (selectedId) {
      setSelectedId(null);
      return;
    }
    const rounded = r3(point);
    const id = newHotspotId(hotspots.map((h) => h.id));
    const next: Hotspot = {
      id,
      label: `Hotspot ${hotspots.length + 1}`,
      position: rounded,
      radius: 0.05,
      correct: hotspots.length === 0,
    };
    writeHotspots([...hotspots, next]);
    setSelectedId(id);
  };

  /**
   * Drag handler: while a pin is being dragged, document pointermove
   * events raycast against the model and update the pin's position in
   * real time. Document pointerup ends the drag.
   *
   * We can't use R3F's onPointerMove on the model because the HTML pin
   * captures the pointer once mousedown lands on it — the pointer
   * events stay on the document, not the canvas. So we replicate R3F's
   * raycast manually using the cached camera + canvas refs.
   */
  useEffect(() => {
    if (!draggingId) return;
    const canvas = canvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    const camera = r3fRef.current.camera;
    const model = modelRef.current;
    if (!canvas || !camera || !model) return;

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      raycasterRef.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hits = raycasterRef.current.intersectObject(model, true);
      if (hits.length === 0) return;
      const hit = hits[0];
      if (!hit) return;
      const local = {
        x: hit.point.x / modelScale,
        y: hit.point.y / modelScale,
        z: hit.point.z / modelScale,
      };
      const rounded = r3(local);
      writeHotspots(
        hotspots.map((h) => (h.id === draggingId ? { ...h, position: rounded } : h)),
      );
    };
    const stop = () => setDraggingId(null);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [draggingId, hotspots, modelScale, writeHotspots]);

  const updateSelected = (patch: Partial<Hotspot>) => {
    if (!selectedHotspot) return;
    writeHotspots(
      hotspots.map((h) => (h.id === selectedHotspot.id ? { ...h, ...patch } : h)),
    );
  };

  const deleteSelected = () => {
    if (!selectedHotspot) return;
    writeHotspots(hotspots.filter((h) => h.id !== selectedHotspot.id));
    setSelectedId(null);
  };

  const saveCurrentView = () => {
    const { position, target } = cameraStateRef.current;
    const prev = config.camera ?? {};
    onChange({
      ...config,
      camera: {
        ...prev,
        initialPosition: r3(position),
        target: r3(target),
      },
    });
  };

  const cameraCfg = config.camera ?? {};
  const hasPinnedView = Boolean(cameraCfg.initialPosition);
  // When the author has pinned a view, honor it exactly. Otherwise,
  // mount the camera at a placeholder; the FrameToModel helper below
  // re-fits to the model's bounding box once the GLB loads.
  const initialPos: [number, number, number] = cameraCfg.initialPosition
    ? [
        cameraCfg.initialPosition.x,
        cameraCfg.initialPosition.y,
        cameraCfg.initialPosition.z,
      ]
    : [0, 0, 1];

  const lightingPreset: LightingPreset =
    config.lighting?.preset && LIGHTING_PRESETS.includes(config.lighting.preset as LightingPreset)
      ? (config.lighting.preset as LightingPreset)
      : DEFAULT_PRESET;

  const sketchfabUid = config.model.sketchfabUid;
  const sfHotspots: SketchfabHotspot[] = sketchfabUid
    ? hotspots.map((h, i) => ({
        id: h.id,
        position: h.position,
        label: h.label ?? h.id,
        number: i + 1,
        kind: selectedId === h.id ? "selected" : h.correct ? "correct" : "default",
      }))
    : [];

  const aspectCssMap: Record<string, string> = {
    "16/10": "16 / 10",
    "16/9": "16 / 9",
    "4/3": "4 / 3",
    "1/1": "1 / 1",
  };
  const aspect = config.behaviour?.aspectRatio ?? "16/10";
  const viewportStyle = { aspectRatio: aspectCssMap[aspect] };

  return (
    <div className="ks-h3d-editor">
      <div
        className="ks-h3d-editor__viewport"
        ref={canvasRef}
        style={viewportStyle}
      >
        {sketchfabUid ? (
          <>
            <SketchfabViewer
              uid={sketchfabUid}
              hotspots={sfHotspots}
              onClickModel={handleModelClick}
              onPickHotspot={(id) => setSelectedId(id)}
            />
            <p className="ks-h3d-editor__hint">
              {selectedId
                ? "Drag the model to orbit. Click empty space or a numbered pin to deselect/select."
                : "Click the model to drop a pin. Click a numbered pin to select it."}
            </p>
          </>
        ) : (
        <>
        <GLBErrorBoundary
          fallback={
            <div className="kukui-glb-error" role="alert">
              <strong className="kukui-glb-error__title">3D model couldn't load</strong>
              <p className="kukui-glb-error__hint">
                Check the URL, CORS headers, or compression format. Then update
                the Model URL field below and try again.
              </p>
            </div>
          }
        >
        <Canvas
          camera={{ position: initialPos, fov: 45, near: 0.001, far: 1000 }}
          gl={{ toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
          onPointerMissed={() => setSelectedId(null)}
        >
          {/* No drei <Environment preset> — that fetches an HDR from
              raw.githack.com which CSP blocks (connect-src 'self').
              Procedural lighting only; flatter shading but ships
              fully self-contained. Match the runtime. */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 4]} intensity={0.9} castShadow={false} />
          <directionalLight position={[-3, 2, -4]} intensity={0.35} castShadow={false} />
          <Suspense fallback={null}>
            {config.model.src ? (
              <ClickableModel
                src={config.model.src}
                scale={modelScale}
                onPlace={handleModelClick}
                sceneRef={modelRef}
              />
            ) : null}
          </Suspense>
          {/* Pins live inside the scaled group so positions are interpreted
              in model-local space — same as the runtime. */}
          <group scale={modelScale}>
            {hotspots.map((h, i) => (
              <HotspotPin
                key={h.id}
                position={h.position}
                number={i + 1}
                label={h.label ?? h.id}
                kind={
                  selectedId === h.id
                    ? "selected"
                    : h.correct
                      ? "correct"
                      : "default"
                }
                onClick={() => setSelectedId(h.id)}
                onPointerDown={() => {
                  setSelectedId(h.id);
                  setDraggingId(h.id);
                }}
                occluders={[modelRef.current]}
                ariaLabel={`Hotspot ${i + 1}: ${h.label ?? h.id}`}
              />
            ))}
          </group>
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
          <CameraStateProbe
            stateRef={cameraStateRef}
            r3fRef={r3fRef}
          />
          {!hasPinnedView ? (
            <FrameToModel modelRef={modelRef} scale={modelScale} />
          ) : null}
        </Canvas>
        <GLBLoadingOverlay />
        </GLBErrorBoundary>
        <p className="ks-h3d-editor__hint">
          Drag to orbit.{" "}
          {selectedId
            ? "Drag the pin to move it. Click anywhere else to deselect."
            : "Click the model to drop a pin. Click a pin to select it."}
        </p>
        </>
        )}
      </div>

      <aside className="ks-h3d-editor__panel" aria-label="Hotspot list">
        <header className="ks-h3d-editor__panel-header">
          <h3>Hotspots ({hotspots.length})</h3>
          <button
            type="button"
            className="ks-h3d-editor__save-view"
            onClick={saveCurrentView}
            title="Save the current camera angle as the starting view for learners"
          >
            Save current view
          </button>
        </header>
        <label className="ks-h3d-editor__field">
          <span>Lighting</span>
          <select
            value={lightingPreset}
            disabled={Boolean(config.model.sketchfabUid)}
            title={
              config.model.sketchfabUid
                ? "Sketchfab embeds use Sketchfab's own lighting"
                : undefined
            }
            onChange={(e) =>
              onChange({
                ...config,
                lighting: { ...(config.lighting ?? {}), preset: e.target.value as LightingPreset },
              })
            }
          >
            <option value="studio">Studio (neutral)</option>
            <option value="warehouse">Warehouse (industrial)</option>
            <option value="park">Park (outdoor)</option>
            <option value="forest">Forest (warm outdoor)</option>
            <option value="lobby">Lobby (soft tinted)</option>
            <option value="sunset">Sunset (dramatic)</option>
          </select>
        </label>
        {hotspots.length === 0 ? (
          <p className="ks-h3d-editor__empty">
            No hotspots yet. Click the model on the left to drop one.
          </p>
        ) : (
          <ul className="ks-h3d-editor__list">
            {hotspots.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className={[
                    "ks-h3d-editor__list-btn",
                    selectedId === h.id ? "is-selected" : "",
                    h.correct ? "is-correct" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSelectedId(h.id)}
                >
                  <span className="ks-h3d-editor__list-label">{h.label ?? h.id}</span>
                  {h.correct ? (
                    <span className="ks-h3d-editor__list-badge" aria-label="correct answer">
                      ✓ correct
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedHotspot ? (
          <div className="ks-h3d-editor__fields">
            <label className="ks-h3d-editor__field">
              <span>Label</span>
              <input
                type="text"
                value={selectedHotspot.label ?? ""}
                onChange={(e) => updateSelected({ label: e.target.value })}
              />
            </label>
            <label className="ks-h3d-editor__field ks-h3d-editor__field--checkbox">
              <input
                type="checkbox"
                checked={selectedHotspot.correct}
                onChange={(e) =>
                  writeHotspots(
                    hotspots.map((h) =>
                      h.id === selectedHotspot.id
                        ? { ...h, correct: e.target.checked }
                        : e.target.checked
                          ? { ...h, correct: false }
                          : h,
                    ),
                  )
                }
              />
              <span>Correct answer</span>
            </label>
            <div className="ks-h3d-editor__field-coords" aria-label="Position (read-only)">
              <code>
                x={selectedHotspot.position.x.toFixed(3)} y=
                {selectedHotspot.position.y.toFixed(3)} z=
                {selectedHotspot.position.z.toFixed(3)}
              </code>
            </div>
            <button
              type="button"
              className="ks-h3d-editor__delete"
              onClick={deleteSelected}
            >
              Delete hotspot
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

/**
 * Click target on the GLB. `ev.point` is the world-space mesh hit;
 * dividing by `scale` converts back to model-local space so the
 * stored position is independent of any future scale changes the
 * author makes.
 */
function ClickableModel({
  src,
  scale,
  onPlace,
  sceneRef,
}: {
  src: string;
  scale: number;
  onPlace: (p: { x: number; y: number; z: number }) => void;
  sceneRef?: React.MutableRefObject<THREE.Object3D | null>;
}) {
  const { scene } = useCompressedGLTF(src);
  useEffect(() => {
    if (sceneRef) sceneRef.current = scene;
    return () => {
      if (sceneRef) sceneRef.current = null;
    };
  }, [scene, sceneRef]);
  return (
    <primitive
      object={scene}
      scale={scale}
      onClick={(ev: ThreeEvent<MouseEvent>) => {
        ev.stopPropagation();
        const p = ev.point;
        onPlace({ x: p.x / scale, y: p.y / scale, z: p.z / scale });
      }}
    />
  );
}

/**
 * One-shot camera framer. After the GLB loads, computes the model's
 * world-space bounding box (after scale is applied) and positions the
 * camera at a distance that frames it with comfortable headroom.
 * Skips on every subsequent frame so the author can orbit freely.
 */
function FrameToModel({
  modelRef,
  scale,
}: {
  modelRef: React.MutableRefObject<THREE.Object3D | null>;
  scale: number;
}) {
  const { camera, controls } = useThree() as {
    camera: THREE.PerspectiveCamera;
    controls: { target: THREE.Vector3; update?: () => void } | null;
  };
  const framedRef = useRef(false);
  useFrame(() => {
    if (framedRef.current) return;
    const model = modelRef.current;
    if (!model) return;
    // Make sure transforms are up-to-date before measuring.
    model.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) return;
    const fovRad = (camera.fov * Math.PI) / 180;
    // Distance that fits the bounding sphere with ~1.5× padding so the
    // model doesn't kiss the viewport edges.
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
    // Silence unused-import lint at the file-level.
    void scale;
  });
  return null;
}

/**
 * In-Canvas helper that copies the live camera position + controls
 * target into a parent-supplied ref every frame, and exposes the
 * camera + renderer for the parent's document-level drag handler.
 */
function CameraStateProbe({
  stateRef,
  r3fRef,
}: {
  stateRef: React.MutableRefObject<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  }>;
  r3fRef: React.MutableRefObject<{
    camera: THREE.Camera | null;
    gl: THREE.WebGLRenderer | null;
  }>;
}) {
  const { camera, controls, gl } = useThree() as {
    camera: THREE.Camera;
    controls: { target?: THREE.Vector3 } | null;
    gl: THREE.WebGLRenderer;
  };
  useEffect(() => {
    r3fRef.current.camera = camera;
    r3fRef.current.gl = gl;
    return () => {
      r3fRef.current.camera = null;
      r3fRef.current.gl = null;
    };
  }, [camera, gl, r3fRef]);
  useFrame(() => {
    stateRef.current.position.copy(camera.position);
    if (controls?.target) {
      stateRef.current.target.copy(controls.target);
    }
  });
  return null;
}
