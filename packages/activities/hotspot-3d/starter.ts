/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted from apps/studio-app/src/starters.ts. The bundled Khronos
 * Box placeholder ships in Studio's public/samples/hotspot-3d/box.glb
 * (Studio keeps its own copy so the dev server can serve it without a
 * cross-package import); the engine bundles its own copy alongside
 * this activity's samples/. The `src` path here is what authors see
 * by default before they replace the model.
 */

const starter = {
  version: "1.0",
  title: "3D Hotspot",
  prompt: "Click the correct part.",
  model: {
    // Bundled Khronos Box placeholder (CC BY 4.0). External CDN URLs
    // here would break inside LMS networks that block external hosts
    // and under engine-web's strict `connect-src 'self'` CSP.
    // Authors should replace this with their own model.
    src: "samples/hotspot-3d/box.glb",
    scale: 1,
    attribution: {
      author: "Khronos Group",
      sourceUrl: "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Box",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
  camera: { initialDistance: 0.6 },
  hotspots: [
    {
      id: "part-a",
      label: "Part A",
      position: { x: 0, y: 0.05, z: 0.07 },
      radius: 0.03,
      correct: true,
    },
    {
      id: "part-b",
      label: "Part B",
      position: { x: 0.18, y: 0, z: 0.05 },
      radius: 0.04,
      correct: false,
    },
  ],
  behaviour: { enableRetry: true, showHotspotMarkers: true, allowOrbit: true },
};

export default starter;
