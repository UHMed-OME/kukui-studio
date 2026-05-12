import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Hotspot3DConfig } from "@kukui/schemas";
import { HotspotPin } from "@kukui/core/components/_shared/HotspotPin";

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

/**
 * Visual editor for 3D Hotspot Identification — Sketchfab-style pins.
 *
 * Hotspots render as numbered HTML pins (`<HotspotPin>`) projected on
 * top of the canvas, never z-occluded by GLB geometry. Clicking a pin
 * selects it; clicking the model relocates the selected pin, otherwise
 * drops a new one. Click empty canvas to deselect.
 *
 * "Save current view" snapshots the OrbitControls camera position +
 * target into `config.camera.initialPosition` / `config.camera.target`
 * so the runtime opens at the same view the author was framing.
 */
export function Hotspot3DEditor({
  config,
  onChange,
}: {
  config: Hotspot3DConfig;
  onChange: (next: Hotspot3DConfig) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hotspots = config.hotspots ?? [];
  const selectedHotspot = useMemo(
    () => hotspots.find((h) => h.id === selectedId) ?? null,
    [hotspots, selectedId],
  );

  const writeHotspots = (next: Hotspot[]) => {
    onChange({ ...config, hotspots: next });
  };

  // Refs shared between the Canvas-internal helper and the side-panel
  // button. The probe writes the live camera state every frame; the
  // Save-view button reads the latest values on click.
  const modelRef = useRef<THREE.Object3D | null>(null);
  const cameraStateRef = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  }>({ position: new THREE.Vector3(), target: new THREE.Vector3() });

  const handleModelClick = (point: { x: number; y: number; z: number }) => {
    const rounded = r3(point);
    if (selectedId) {
      writeHotspots(
        hotspots.map((h) => (h.id === selectedId ? { ...h, position: rounded } : h)),
      );
      return;
    }
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
  const initialPos: [number, number, number] = cameraCfg.initialPosition
    ? [
        cameraCfg.initialPosition.x,
        cameraCfg.initialPosition.y,
        cameraCfg.initialPosition.z,
      ]
    : [0, 0.05, cameraCfg.initialDistance ?? 0.6];

  return (
    <div className="ks-h3d-editor">
      <div className="ks-h3d-editor__viewport">
        <Canvas
          camera={{ position: initialPos, fov: 35 }}
          onPointerMissed={() => setSelectedId(null)}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 4]} intensity={1.0} />
          <directionalLight position={[-3, 2, -2]} intensity={0.4} />
          <Suspense fallback={null}>
            <ClickableModel
              src={config.model.src}
              scale={config.model.scale ?? 1}
              onPlace={handleModelClick}
              sceneRef={modelRef}
            />
          </Suspense>
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
              occluders={[modelRef.current]}
              ariaLabel={`Hotspot ${i + 1}: ${h.label ?? h.id}`}
            />
          ))}
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
          <CameraStateProbe stateRef={cameraStateRef} />
        </Canvas>
        <p className="ks-h3d-editor__hint">
          Drag to orbit ·{" "}
          {selectedId
            ? "Click anywhere on the model to MOVE the selected pin · Click empty space to deselect"
            : "Click the model to drop a new pin · Click a pin to select it"}
        </p>
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
 * The GLB renders as a `<primitive>` whose pointer events fire on the
 * surface hit by the cursor. We capture that point in world space and
 * undo the global `scale` so the hotspot config stores positions in
 * the model's own coordinate space (matches the runtime's `scale`
 * passthrough).
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
  const { scene } = useGLTF(src);
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
 * In-Canvas helper that copies the current camera position + controls
 * target into a parent-supplied ref every frame. The Save-view button
 * outside the canvas reads the ref on click — no events, no
 * prop-drilling state through the R3F boundary.
 */
function CameraStateProbe({
  stateRef,
}: {
  stateRef: React.MutableRefObject<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  }>;
}) {
  const { camera, controls } = useThree() as {
    camera: THREE.Camera;
    controls: { target?: THREE.Vector3 } | null;
  };
  useFrame(() => {
    stateRef.current.position.copy(camera.position);
    if (controls?.target) {
      stateRef.current.target.copy(controls.target);
    }
  });
  return null;
}
