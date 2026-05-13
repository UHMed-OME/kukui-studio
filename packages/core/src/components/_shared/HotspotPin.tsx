import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

/**
 * Sketchfab-style HTML annotation pin for 3D scenes.
 *
 * Renders as a numbered HTML circle at the projected screen position of
 * a 3D anchor point — solving the "marker disappears behind geometry"
 * problem by rendering on top of the canvas instead of as a 3D mesh.
 *
 * Occlusion detection: every frame, raycast from the camera toward the
 * 3D anchor. If anything in the `occluders` array (typically the model
 * scene) sits between the camera and the anchor, the pin gets an
 * `is-behind` class so CSS can dim / dash it — still visible, but
 * clearly marked as around the back of the model.
 *
 * Click semantics: the pin is a regular HTML <button>, so it picks up
 * focus, keyboard activation, and touch targets for free — no 3D
 * raycasting required to click a small sphere.
 */
export type HotspotPinKind =
  | "default"
  | "selected"
  | "correct"
  | "incorrect"
  | "reveal";

export function HotspotPin({
  position,
  number,
  label,
  kind = "default",
  disabled,
  onClick,
  onPointerDown,
  occluders,
  ariaLabel,
}: {
  position: { x: number; y: number; z: number };
  number?: number;
  label?: string;
  kind?: HotspotPinKind;
  disabled?: boolean;
  onClick?: () => void;
  /**
   * Optional pointerdown — used by editor surfaces (Hotspot3DEditor)
   * to start a drag-to-reposition gesture. The editor takes over from
   * here with document-level pointermove + raycast. Activity runtime
   * doesn't pass this; pins behave as plain buttons.
   */
  onPointerDown?: () => void;
  occluders?: ReadonlyArray<THREE.Object3D | null | undefined>;
  ariaLabel?: string;
}) {
  // Invisible anchor in the 3D scene at the hotspot position. We
  // raycast against this every frame and ask drei <Html> to project to
  // its screen coordinate.
  const anchorRef = useRef<THREE.Object3D>(null);
  const [behind, setBehind] = useState(false);
  const { camera } = useThree();

  // Stable raycaster between frames.
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  if (!raycasterRef.current) raycasterRef.current = new THREE.Raycaster();

  useFrame(() => {
    const anchor = anchorRef.current;
    const raycaster = raycasterRef.current;
    if (!anchor || !raycaster || !occluders || occluders.length === 0) {
      if (behind) setBehind(false);
      return;
    }
    const anchorWorld = anchor.getWorldPosition(new THREE.Vector3());
    const camPos = camera.position;
    const toAnchor = anchorWorld.clone().sub(camPos);
    const dist = toAnchor.length();
    if (dist === 0) {
      if (behind) setBehind(false);
      return;
    }
    toAnchor.normalize();
    raycaster.set(camPos, toAnchor);
    // Stop just before the anchor itself so we don't self-hit.
    raycaster.far = dist - 1e-3;
    let occluded = false;
    for (const obj of occluders) {
      if (!obj) continue;
      const hits = raycaster.intersectObject(obj, true);
      if (hits.length > 0) {
        occluded = true;
        break;
      }
    }
    if (occluded !== behind) setBehind(occluded);
  });

  return (
    <group position={[position.x, position.y, position.z]}>
      <object3D ref={anchorRef} />
      <Html
        center
        zIndexRange={[100, 0]}
        // Don't auto-hide on occlude — we want the pin visible always,
        // just styled differently when behind geometry.
        occlude={false}
        style={{ pointerEvents: "auto" }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onClick?.();
          }}
          onPointerDown={(e) => {
            if (disabled || !onPointerDown) return;
            e.stopPropagation();
            // Don't preventDefault — that would block the button's
            // focus/click behavior the editor still wants for a simple
            // click that doesn't move.
            onPointerDown();
          }}
          className={[
            "kukui-pin",
            `kukui-pin--${kind}`,
            behind ? "is-behind" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={ariaLabel ?? label ?? `Hotspot ${number ?? ""}`.trim()}
        >
          {typeof number === "number" ? (
            <span className="kukui-pin__num" aria-hidden="true">
              {number}
            </span>
          ) : null}
          {label ? <span className="kukui-pin__label">{label}</span> : null}
        </button>
      </Html>
    </group>
  );
}

/**
 * Helper hook: reads useThree's gl + scene + camera so a host editor
 * can snapshot the current camera position + target. Used by the
 * "Save current view" affordance in Hotspot3DEditor and the (future)
 * VirtualTourEditor.
 *
 * Returns a function that captures (position, target) on demand. The
 * caller passes the captured values back into the activity config.
 */
export function useCameraSnapshot() {
  const { camera, controls } = useThree() as {
    camera: THREE.Camera;
    controls: { target?: THREE.Vector3 } | null;
  };
  return () => {
    const p = camera.position;
    const t = controls?.target ?? new THREE.Vector3(0, 0, 0);
    return {
      position: { x: p.x, y: p.y, z: p.z },
      target: { x: t.x, y: t.y, z: t.z },
    };
  };
}

// CSS lives in Hotspot3D.css + VirtualTour.css; pin classes are
// `.kukui-pin` shared between both surfaces.
export const PIN_STYLES_NOTE =
  "Pin styling lives in the activity CSS files — they share .kukui-pin classes.";

// Keep the import side-effect free at module load.
void useEffect;
