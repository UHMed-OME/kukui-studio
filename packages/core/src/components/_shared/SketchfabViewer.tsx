import { useCallback, useEffect, useId, useRef, useState } from "react";
import * as THREE from "three";
import "./SketchfabViewer.css";

/**
 * Embeds a Sketchfab model via their Viewer API and overlays HTML pins
 * on top of the iframe, kept in sync with the live camera each frame.
 *
 * Why an iframe instead of loading the GLB ourselves: Sketchfab
 * requires OAuth to download models. The Viewer API lets anyone embed
 * any *public* model with just its UID — no auth, no Client ID. The
 * trade-off is the Sketchfab branding/controls are visible (logo,
 * fullscreen button, their orbit gesture). Most learners are
 * comfortable with the Sketchfab UI since many educational sources
 * already use it.
 *
 * Projection: every frame we poll `api.getCameraLookAt` and
 * `api.getFov` (cached after first read; FOV rarely changes), build a
 * view + projection matrix with three.js, project each hotspot
 * world-position to NDC, then map to iframe-relative pixel coords.
 * Pins update their CSS transforms directly via refs — no React
 * re-renders per frame.
 */

declare global {
  interface Window {
    // Sketchfab's loader script attaches `Sketchfab` to window once
    // the script tag loads. Single-arg form (just the iframe) is the
    // signature the current viewer-1.12.1 script ships; older docs
    // showed `(version, iframe)` but passing a number there throws
    // "No API named '<num>'" because Sketchfab's API registry keys are
    // strings (the actual viewer version like "1.12.1"). Stick to the
    // single-arg form.
    Sketchfab?: new (
      iframe: HTMLIFrameElement,
    ) => { init: (uid: string, opts: SketchfabInitOpts) => void };
  }
}

interface SketchfabInitOpts {
  success: (api: SketchfabApi) => void;
  error?: () => void;
  ui_infos?: 0 | 1;
  ui_controls?: 0 | 1;
  ui_stop?: 0 | 1;
  ui_watermark?: 0 | 1;
  autostart?: 0 | 1;
  preload?: 0 | 1;
  graph_optimizer?: 0 | 1;
  transparent?: 0 | 1;
}

interface SketchfabApi {
  start: () => void;
  addEventListener: (
    event: "viewerready" | "click" | "camerastart" | "camerastop",
    cb: (ev: SketchfabClickEvent) => void,
  ) => void;
  getCameraLookAt: (cb: (err: unknown, lookAt: SketchfabLookAt) => void) => void;
  getFov: (cb: (err: unknown, fov: number) => void) => void;
}

interface SketchfabClickEvent {
  position3D?: [number, number, number];
  normal?: [number, number, number];
}

interface SketchfabLookAt {
  position: [number, number, number];
  target: [number, number, number];
}

const SKETCHFAB_API_SRC = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";

let scriptLoadPromise: Promise<void> | null = null;

function loadSketchfabApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Sketchfab) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SKETCHFAB_API_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error("Failed to load Sketchfab Viewer API"));
    };
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export interface SketchfabHotspot {
  id: string;
  position: { x: number; y: number; z: number };
  label?: string;
  /**
   * Visual state — mirrors HotspotPin's `kind` so the wrapper styles
   * the overlay buttons with the same .kukui-pin classes.
   */
  kind?: "default" | "selected" | "correct" | "incorrect" | "reveal";
  number?: number;
}

export function SketchfabViewer({
  uid,
  hotspots,
  onClickModel,
  onPickHotspot,
  showMarkers = true,
}: {
  uid: string;
  hotspots: SketchfabHotspot[];
  /**
   * Editor mode — called when the learner clicks the model (not a
   * pin). Position is in Sketchfab world space (same coordinate space
   * as `hotspots[i].position`).
   */
  onClickModel?: (position: { x: number; y: number; z: number }) => void;
  /** Called when a pin overlay is clicked. */
  onPickHotspot?: (id: string) => void;
  showMarkers?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<SketchfabApi | null>(null);
  const fovRef = useRef<number>(45);
  // Stable per-hotspot refs so the per-frame projection loop can
  // update CSS transforms without re-rendering React.
  const pinRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const onClickModelRef = useRef(onClickModel);
  onClickModelRef.current = onClickModel;
  // Live ref to the hotspot list so the rAF projection loop sees pins
  // added after mount. The effect only re-runs on UID change, so without
  // this ref the closure would iterate the initial array forever —
  // editor pins dropped post-mount would stay invisible at left:0.
  const hotspotsRef = useRef(hotspots);
  hotspotsRef.current = hotspots;

  const setPinRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) pinRefs.current.set(id, el);
    else pinRefs.current.delete(id);
  }, []);

  const titleId = useId();

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    const wrap = wrapRef.current;
    const iframe = iframeRef.current;
    if (!wrap || !iframe) return;

    const tmpCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    const tmpVec = new THREE.Vector3();

    const tickProjection = () => {
      if (cancelled) return;
      const api = apiRef.current;
      if (!api || !wrap) {
        rafId = requestAnimationFrame(tickProjection);
        return;
      }
      api.getCameraLookAt((err, lookAt) => {
        if (err || cancelled) return;
        const rect = wrap.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        tmpCamera.position.set(
          lookAt.position[0],
          lookAt.position[1],
          lookAt.position[2],
        );
        tmpCamera.up.set(0, 1, 0);
        tmpCamera.lookAt(lookAt.target[0], lookAt.target[1], lookAt.target[2]);
        tmpCamera.fov = fovRef.current;
        tmpCamera.aspect = rect.width / rect.height;
        tmpCamera.updateMatrixWorld();
        tmpCamera.updateProjectionMatrix();
        for (const hot of hotspotsRef.current) {
          const el = pinRefs.current.get(hot.id);
          if (!el) continue;
          tmpVec.set(hot.position.x, hot.position.y, hot.position.z);
          tmpVec.project(tmpCamera);
          // Pins behind the camera get z > 1 in NDC after the perspective
          // divide; hide them to prevent ghost overlays at the edges.
          const behindCamera = tmpVec.z > 1 || tmpVec.z < -1;
          const sx = (tmpVec.x * 0.5 + 0.5) * rect.width;
          const sy = (-tmpVec.y * 0.5 + 0.5) * rect.height;
          el.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`;
          el.style.opacity = behindCamera ? "0" : "1";
          el.style.pointerEvents = behindCamera ? "none" : "auto";
        }
      });
      rafId = requestAnimationFrame(tickProjection);
    };

    /**
     * Sketchfab's `viewerready` event has been unreliable across versions —
     * for some embedded models it never fires even after the scene is
     * fully loaded and interactive, leaving our loading overlay stuck
     * over a visible model. Keep the event as the primary signal but
     * back it up with two fallbacks:
     *   - iframe `load`: fires when the Sketchfab page (containing the
     *     viewer) has finished loading. Not the same as the model being
     *     visible, but a strong proxy and always fires.
     *   - 15 s timeout: hard ceiling. If neither signal arrives by then,
     *     the model has either loaded fine without telling us or it'll
     *     never load — either way, get out of the user's face.
     */
    const markReady = () => {
      if (cancelled) return;
      setStatus((prev) => (prev === "loading" ? "ready" : prev));
    };
    const fallbackTimeout = window.setTimeout(markReady, 15_000);
    const onIframeLoad = () => {
      // Iframe load fires before the model finishes downloading; give
      // the viewer a short grace period so the user doesn't see a black
      // canvas with no overlay.
      window.setTimeout(markReady, 1500);
    };
    iframe.addEventListener("load", onIframeLoad);

    loadSketchfabApi()
      .then(() => {
        if (cancelled || !window.Sketchfab) return;
        const client = new window.Sketchfab(iframe);
        client.init(uid, {
          success: (api) => {
            apiRef.current = api;
            // Start the projection loop as soon as the API is up — don't
            // wait for `viewerready` like we used to. That event is the
            // same one that proved unreliable for the loading overlay,
            // and gating pin projection on it meant the overlay was
            // permanently invisible on those models. tickProjection
            // safely no-ops while getCameraLookAt errors, so spinning
            // a few empty frames before the camera is ready costs
            // nothing.
            rafId = requestAnimationFrame(tickProjection);
            api.addEventListener("viewerready", () => {
              markReady();
              api.getFov((_err, fov) => {
                if (typeof fov === "number" && fov > 0) fovRef.current = fov;
              });
              api.addEventListener("click", (ev) => {
                const p = ev.position3D;
                if (!p) return;
                onClickModelRef.current?.({ x: p[0], y: p[1], z: p[2] });
              });
            });
            api.start();
          },
          error: () => {
            if (!cancelled) setStatus("error");
          },
          autostart: 1,
          ui_infos: 0,
          ui_stop: 0,
          preload: 1,
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(fallbackTimeout);
      iframe.removeEventListener("load", onIframeLoad);
      apiRef.current = null;
    };
    // Effect lifecycle is bound to the UID, not every hotspot edit. The
    // rAF closure reads hotspots via `hotspotsRef.current` (set above)
    // so new pins added post-mount get projected too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return (
    <div className="kukui-sketchfab" ref={wrapRef}>
      <iframe
        ref={iframeRef}
        title="Sketchfab 3D model"
        aria-labelledby={titleId}
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
        className="kukui-sketchfab__iframe"
      />
      {status === "loading" ? (
        <div className="kukui-glb-loading" role="status">
          <span className="kukui-glb-loading__spinner" aria-hidden="true" />
          <span>Loading Sketchfab model…</span>
        </div>
      ) : null}
      {status === "error" ? (
        <div className="kukui-glb-error" role="alert">
          <strong className="kukui-glb-error__title">Sketchfab model couldn't load</strong>
          <p className="kukui-glb-error__hint">
            The model UID may be invalid, private, or Sketchfab may be
            temporarily unreachable. Use the keyboard list below.
          </p>
        </div>
      ) : null}
      {showMarkers && status === "ready"
        ? hotspots.map((h) => (
            <button
              key={h.id}
              ref={(el) => setPinRef(h.id, el)}
              type="button"
              className={[
                "kukui-pin",
                `kukui-pin--${h.kind ?? "default"}`,
                "kukui-sketchfab__pin",
              ].join(" ")}
              onClick={(e) => {
                e.stopPropagation();
                onPickHotspot?.(h.id);
              }}
              aria-label={h.label ?? h.id}
              style={{ position: "absolute", left: 0, top: 0, opacity: 0 }}
            >
              {typeof h.number === "number" ? (
                <span className="kukui-pin__num" aria-hidden="true">
                  {h.number}
                </span>
              ) : null}
              {h.label ? <span className="kukui-pin__label">{h.label}</span> : null}
            </button>
          ))
        : null}
      <span id={titleId} className="kukui-visually-hidden">
        Sketchfab embedded 3D model
      </span>
    </div>
  );
}
