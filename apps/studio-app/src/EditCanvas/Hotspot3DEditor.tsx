import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import type { Hotspot3DConfig } from "@kukui/schemas";

type Hotspot = Hotspot3DConfig["hotspots"][number];

const roundCoord = (n: number) => Math.round(n * 1000) / 1000;

const newHotspotId = (existing: string[]): string => {
  let i = existing.length + 1;
  while (existing.includes(`h-${i}`)) i += 1;
  return `h-${i}`;
};

/**
 * Visual editor for 3D Hotspot Identification.
 *
 * Authors orbit the model with click-and-drag (left mouse), then click a
 * point on the surface to drop a new hotspot at that 3D point. The
 * raycast hit position is captured from `@react-three/fiber`'s pointer
 * event — no manual three.js plumbing required.
 *
 * Existing hotspots are rendered as the same sphere markers learners see,
 * with a selection ring around the currently-selected one. The side panel
 * holds the editable fields (label, correct flag, radius) and a delete
 * affordance — coordinate fields are intentionally absent here; if an
 * author needs sub-millimeter precision they can drop to the form/JSON
 * editor.
 *
 * One author-only convention: when the model is first placed, OrbitControls
 * lets the author rotate freely; clicking the model surface fires the
 * place-hotspot handler. Clicking an *existing* hotspot just selects it
 * (without dropping a new one underneath).
 */
export function Hotspot3DEditor({
  config,
  onChange,
}: {
  config: Hotspot3DConfig;
  onChange: (next: Hotspot3DConfig) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;

  const hotspots = config.hotspots ?? [];
  const selectedHotspot = useMemo(
    () => hotspots.find((h) => h.id === selectedId) ?? null,
    [hotspots, selectedId],
  );

  const writeHotspots = (next: Hotspot[]) => {
    onChange({ ...config, hotspots: next });
  };

  const placeHotspot = (point: { x: number; y: number; z: number }) => {
    const id = newHotspotId(hotspots.map((h) => h.id));
    const next: Hotspot = {
      id,
      label: `Hotspot ${hotspots.length + 1}`,
      position: { x: roundCoord(point.x), y: roundCoord(point.y), z: roundCoord(point.z) },
      // Picking a sensible default radius is tricky without knowing model
      // bounds; the existing learner config defaults to 0.05–0.1 for
      // common medical models, so seed with 0.05 and let authors widen.
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

  const cameraCfg = config.camera ?? {};

  return (
    <div className="ks-h3d-editor">
      <div className="ks-h3d-editor__viewport">
        <Canvas
          camera={{ position: [0, 0.05, cameraCfg.initialDistance ?? 0.6], fov: 35 }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 4]} intensity={1.0} />
          <directionalLight position={[-3, 2, -2]} intensity={0.4} />
          <Suspense fallback={null}>
            <ClickableModel
              src={config.model.src}
              scale={config.model.scale ?? 1}
              onPlace={placeHotspot}
            />
          </Suspense>
          {hotspots.map((h) => (
            <EditorMarker
              key={h.id}
              hotspot={h}
              selected={selectedId === h.id}
              onSelect={() => setSelectedId(h.id)}
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
        </Canvas>
        <p className="ks-h3d-editor__hint">
          Drag to orbit · Click the model to place a hotspot · Click a hotspot to select it
        </p>
      </div>

      <aside className="ks-h3d-editor__panel" aria-label="Hotspot list">
        <header className="ks-h3d-editor__panel-header">
          <h3>Hotspots ({hotspots.length})</h3>
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
            <label className="ks-h3d-editor__field">
              <span>Radius</span>
              <input
                type="number"
                step={0.005}
                min={0.005}
                value={selectedHotspot.radius}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n > 0) updateSelected({ radius: n });
                }}
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
                        : // The schema doesn't *require* one correct answer
                          // here, but the activity is a single-pick task so
                          // we enforce the convention: ticking one unticks
                          // the rest.
                          e.target.checked
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

function ClickableModel({
  src,
  scale,
  onPlace,
}: {
  src: string;
  scale: number;
  onPlace: (p: { x: number; y: number; z: number }) => void;
}) {
  const { scene } = useGLTF(src);
  return (
    <primitive
      object={scene}
      scale={scale}
      onClick={(ev: ThreeEvent<MouseEvent>) => {
        // Pointer hit point in world coords. `stopPropagation` so we don't
        // also fire the OrbitControls click that resets the camera target.
        ev.stopPropagation();
        const p = ev.point;
        onPlace({ x: p.x / scale, y: p.y / scale, z: p.z / scale });
      }}
    />
  );
}

function EditorMarker({
  hotspot,
  selected,
  onSelect,
}: {
  hotspot: Hotspot;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <group position={[hotspot.position.x, hotspot.position.y, hotspot.position.z]}>
      <mesh
        onClick={(ev) => {
          // Clicking an existing marker selects it — never drops a new
          // hotspot underneath. The `stopPropagation` keeps the click from
          // bubbling up to the ClickableModel.
          ev.stopPropagation();
          onSelect();
        }}
      >
        <sphereGeometry args={[hotspot.radius, 24, 24]} />
        <meshStandardMaterial
          color={selected ? "#b69b5d" : hotspot.correct ? "#2e6e41" : "#7b4324"}
          transparent
          opacity={selected ? 0.95 : 0.7}
          emissive={selected ? "#b69b5d" : "#000000"}
          emissiveIntensity={selected ? 0.4 : 0}
        />
      </mesh>
      <Html center distanceFactor={8} occlude={false} style={{ pointerEvents: "none" }}>
        <div
          aria-hidden="true"
          style={{
            background: selected ? "#b69b5d" : "rgba(28, 30, 32, 0.85)",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            border: `2px solid ${selected ? "#ffffff" : "#7b4324"}`,
            transform: "translateY(-150%)",
          }}
        >
          {hotspot.label ?? hotspot.id}
        </div>
      </Html>
    </group>
  );
}
