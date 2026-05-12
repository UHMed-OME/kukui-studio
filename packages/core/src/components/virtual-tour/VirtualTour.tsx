import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { HotspotPin } from "../_shared/HotspotPin.js";
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

  // Reset local state when `config` changes externally (Studio Preview edit,
  // AI Accept, draft load, etc.). Reference equality on the `config` prop —
  // engine context loads JSON once and never mutates the ref, so this only
  // fires in Studio Preview. Replaces the now-removed JSON.stringify(value)
  // remount key.
  useEffect(() => {
    setState(
      parseSuspend(suspendData) ?? { stage: "exploring", visited: [], openOverlayId: null },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

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

  // Remember the element that had focus when the overlay opened so we
  // can return focus to it on close — keyboard users would otherwise
  // lose their place in the overlay-list every time they dismiss.
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const visit = (overlayId: string) => {
    if (state.stage === "submitted") return;
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      lastFocusRef.current = document.activeElement;
    }
    setState((s) => {
      const visited = s.visited.includes(overlayId) ? s.visited : [...s.visited, overlayId];
      return { ...s, visited, openOverlayId: overlayId };
    });
  };

  const closeOverlay = () => {
    setState((s) => ({ ...s, openOverlayId: null }));
    // Defer the focus restore so React commits the close first and the
    // close button isn't still the active element.
    queueMicrotask(() => lastFocusRef.current?.focus?.());
  };

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

        <VirtualTourScene
          config={config}
          disabled={submitted}
          overlayOpen={state.openOverlayId !== null}
          visited={new Set(state.visited)}
          onVisit={visit}
        />

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
          <div className="kukui-vt__overlay" role="dialog" aria-labelledby="vt-overlay-title">
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
  overlayOpen,
  visited,
  onVisit,
}: {
  config: VirtualTourConfig;
  disabled: boolean;
  overlayOpen: boolean;
  visited: Set<string>;
  onVisit: (id: string) => void;
}) {
  // Probe both webgl and webgl2 — Safari with strict privacy settings
  // can return null for "webgl" but still have webgl2 available.
  const hasWebGL =
    typeof window !== "undefined" &&
    typeof window.WebGLRenderingContext !== "undefined" &&
    (() => {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    })();

  if (!hasWebGL) {
    return (
      <div className="kukui-vt__no-webgl" role="img" aria-label="3D scene placeholder">
        3D scene unavailable in this environment. Use the points-of-interest list below.
      </div>
    );
  }

  const spawn = config.scene.spawn?.position ?? { x: 0, y: 1.6, z: 3 };
  const movementSpeed = config.movement?.speed ?? 3;
  // The model is the occluder for each pin's per-frame raycast — pins
  // show `.is-behind` styling when their anchor is round a corner /
  // behind a wall, so the learner can still see where unvisited points
  // are without losing depth information.
  const sceneRef = useRef<THREE.Object3D | null>(null);

  return (
    <div className="kukui-vt__canvas-wrap">
      <p className="kukui-vt__hint" role="note">
        Click and drag to look around · WASD or arrow keys to move · Click a marker to visit it
      </p>
      <Canvas camera={{ position: [spawn.x, spawn.y, spawn.z], fov: 60 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 4]} intensity={0.9} />
        <directionalLight position={[-4, 3, -3]} intensity={0.4} />
        <Suspense fallback={null}>
          <TourModel src={config.scene.src} sceneRef={sceneRef} />
        </Suspense>
        <FirstPersonRig speed={movementSpeed} enabled={!disabled && !overlayOpen} />
        <DragLookControls />
        {config.overlays.map((o, i) => (
          <HotspotPin
            key={o.id}
            position={o.position}
            number={i + 1}
            label={o.title ?? o.id}
            kind={visited.has(o.id) ? "reveal" : "default"}
            disabled={disabled}
            onClick={() => onVisit(o.id)}
            occluders={[sceneRef.current]}
            ariaLabel={`Overlay ${i + 1}: ${o.title ?? o.id}`}
          />
        ))}
      </Canvas>
    </div>
  );
}

/**
 * First-person camera rig: WASD / arrow keys translate the camera in the
 * direction it's facing. PointerLockControls handles the look-around. The
 * key listener is attached to `window` so it fires regardless of where focus
 * sits — keyboard users still need PointerLock to be active to see the
 * camera move with the look direction.
 */
function FirstPersonRig({ speed, enabled }: { speed: number; enabled: boolean }) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // When disabled (e.g., the overlay dialog is open or the activity is
    // submitted), drop the window listeners entirely. Without this guard,
    // arrow keys would simultaneously scroll the overlay and move the
    // 3D camera in the background.
    if (!enabled) {
      keys.current = {};
      return;
    }
    const map: Record<string, string> = {
      w: "forward",
      W: "forward",
      ArrowUp: "forward",
      s: "back",
      S: "back",
      ArrowDown: "back",
      a: "left",
      A: "left",
      ArrowLeft: "left",
      d: "right",
      D: "right",
      ArrowRight: "right",
    };
    const down = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (dir) {
        keys.current[dir] = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (dir) keys.current[dir] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [enabled]);

  const forwardVec = useMemo(() => new THREE.Vector3(), []);
  const rightVec = useMemo(() => new THREE.Vector3(), []);
  const upVec = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_, dt) => {
    const d = speed * dt;
    camera.getWorldDirection(forwardVec);
    forwardVec.y = 0;
    forwardVec.normalize();
    rightVec.crossVectors(forwardVec, upVec).normalize();
    if (keys.current.forward) camera.position.addScaledVector(forwardVec, d);
    if (keys.current.back) camera.position.addScaledVector(forwardVec, -d);
    if (keys.current.right) camera.position.addScaledVector(rightVec, d);
    if (keys.current.left) camera.position.addScaledVector(rightVec, -d);
  });

  return null;
}

/**
 * Drag-to-look camera controller — no pointer lock.
 *
 * On pointerdown anywhere on the canvas we start tracking; on
 * pointermove we accumulate yaw / pitch deltas and reorient the camera;
 * on pointerup we stop. Because we never call requestPointerLock(), the
 * cursor stays visible and the browser's Escape-to-release trap never
 * fires — closing the "click to enter tour, hit Escape to leave" UX
 * dead-end that PointerLockControls would otherwise inflict on learners.
 *
 * Single-click hotspot picking still works: r3f's `onClick` listens to
 * the DOM click event, which the browser only dispatches when pointerup
 * happens on the same target after a near-stationary pointerdown. A real
 * drag (more than ~5 px of movement) suppresses the click, so the camera
 * rotates and the hotspot underneath does NOT get visited unintentionally.
 *
 * Pitch is clamped to ±85° so the camera can't flip upside-down.
 */
function DragLookControls() {
  const { camera, gl } = useThree();
  // Initialise yaw/pitch from the camera's current rotation so the spawn
  // position the config asked for is preserved.
  const eulerRef = useRef<THREE.Euler>(
    new THREE.Euler(0, 0, 0, "YXZ"),
  );
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    eulerRef.current.setFromQuaternion(camera.quaternion);
    eulerRef.current.order = "YXZ";
    setInitialized(true);
  }, [camera, initialized]);

  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let pid = -1;
    let lastX = 0;
    let lastY = 0;
    const SENSITIVITY = 0.0025;
    const PITCH_LIMIT = (Math.PI / 2) * 0.94;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      pid = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* setPointerCapture isn't critical — bail silently if unsupported */
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pid) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const eul = eulerRef.current;
      eul.y -= dx * SENSITIVITY;
      eul.x -= dy * SENSITIVITY;
      eul.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, eul.x));
      camera.quaternion.setFromEuler(eul);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      dragging = false;
      pid = -1;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* releasePointerCapture isn't critical — bail silently if unsupported */
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [camera, gl]);

  return null;
}

function TourModel({
  src,
  sceneRef,
}: {
  src: string;
  sceneRef?: React.MutableRefObject<THREE.Object3D | null>;
}) {
  const { scene } = useGLTF(src);
  useEffect(() => {
    if (sceneRef) sceneRef.current = scene;
    return () => {
      if (sceneRef) sceneRef.current = null;
    };
  }, [scene, sceneRef]);
  return <primitive object={scene} />;
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
