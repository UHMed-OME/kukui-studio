import { Component, useMemo, type ReactNode } from "react";
import { useGLTF, useProgress } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { KTX2Loader } from "three-stdlib";
import "./glb-loader.css";

const DRACO_PATH = "/decoders/draco/";
const BASIS_PATH = "/decoders/basis/";

/**
 * Loads a GLB/GLTF with DRACO + KTX2 + Meshopt support enabled.
 * Most real-world models (Sketchfab downloads, Khronos glTF samples,
 * NIH 3D, Smithsonian) ship with at least one of these compression
 * types; plain useGLTF silently fails when it hits an extension it
 * can't decode.
 *
 * Decoder assets must be served at /decoders/{draco,basis}/ — the
 * canonical source lives in apps/studio-app/public/decoders. SCORM
 * activity builds need to copy these into their static output.
 */
export function useCompressedGLTF(src: string) {
  const { gl } = useThree();
  const ktx2 = useMemo(() => {
    const loader = new KTX2Loader();
    loader.setTranscoderPath(BASIS_PATH);
    loader.detectSupport(gl);
    return loader;
  }, [gl]);
  return useGLTF(src, DRACO_PATH, true, (loader) => {
    loader.setKTX2Loader(ktx2);
  });
}

/**
 * DOM overlay shown while drei's global loading store reports an
 * active load. Pair with a sibling Canvas — render this inside the
 * same `position: relative` wrapper. Reads drei's useProgress hook
 * which tracks every useLoader call across the page, so a single
 * overlay handles all concurrent GLB loads automatically.
 */
export function GLBLoadingOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="kukui-glb-loading" role="status" aria-live="polite">
      <span className="kukui-glb-loading__spinner" aria-hidden="true" />
      <span>Loading model… {Math.round(progress)}%</span>
    </div>
  );
}

/**
 * Error boundary for the Canvas + its GLB load. Catches useGLTF /
 * GLTFLoader throws (404, CORS, malformed file, missing decoder,
 * unsupported extension) and renders the fallback. Without this,
 * the Canvas crash propagates up and kills the activity.
 */
export class GLBErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  override componentDidCatch(error: Error) {
    console.warn("[Kukui] 3D model failed to load:", error);
  }
  override render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
