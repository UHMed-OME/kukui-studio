/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted from apps/studio-app/src/starters.ts. The bundled placeholder
 * model ships in Studio's public/samples/virtual-tour/box.glb (Studio
 * keeps its own copy so the dev server can serve it without a
 * cross-package import); the engine bundles its own copy alongside this
 * activity's samples/. The `src` path here is what authors see by default
 * before they replace the scene.
 */

const starter = {
  version: "1.0",
  title: "Virtual Tour",
  scene: {
    // Bundled placeholder (CC BY 4.0) — see comment under hotspot-3d.
    src: "samples/virtual-tour/box.glb",
    spawn: { position: { x: 0, y: 0.5, z: 4 } },
  },
  movement: { speed: 2 },
  overlays: [
    {
      id: "stop-1",
      title: "Point of interest",
      position: { x: 0, y: 0, z: 0 },
      trigger: "click",
      content: [{ type: "text", html: "Describe this point." }],
    },
  ],
  completion: { mode: "manual" },
  behaviour: { enableRetry: true },
};

export default starter;
