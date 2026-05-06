# Kukui third-party engine integration

Kukui is built on React, but its SCORM packaging + D2L grade-passback pipeline is content-engine agnostic. Authors who prefer Unity, Godot, Articulate, or any tool that compiles to WebGL/HTML5 can integrate via the small `@kukui/bridge` JavaScript library.

## What the bridge gives you

A standardized `window.kukuiBridge` with five methods, attached automatically when an activity loads:

```js
window.kukuiBridge.OnActivityComplete(raw, max, success);
window.kukuiBridge.SaveSuspendData(json);
window.kukuiBridge.LoadSuspendData();
window.kukuiBridge.GetUrlParam(key);
window.kukuiBridge.IsConnected();
```

The bridge handles SCORM 1.2 init / commit / terminate via pipwerks under the hood, so your engine code just calls these five methods and gets D2L grade passback for free.

## Unity (WebGL)

1. Copy [`packages/bridge/src/kukui-bridge.jslib`](../packages/bridge/src/kukui-bridge.jslib) into your Unity project at `Assets/Plugins/WebGL/kukui-bridge.jslib`.

2. Declare the imports in any MonoBehaviour:

   ```csharp
   using System.Runtime.InteropServices;

   public class KukuiBridge {
     [DllImport("__Internal")] public static extern void KukuiOnActivityComplete(float raw, float max, int success);
     [DllImport("__Internal")] public static extern void KukuiSaveSuspendData(string json);
     [DllImport("__Internal")] public static extern string KukuiLoadSuspendData();
     [DllImport("__Internal")] public static extern string KukuiGetUrlParam(string key);
     [DllImport("__Internal")] public static extern int KukuiIsConnected();
   }
   ```

3. Call them from your gameplay code:

   ```csharp
   void OnActivityFinished(int score, int max, bool passed) {
   #if UNITY_WEBGL && !UNITY_EDITOR
     KukuiBridge.KukuiOnActivityComplete(score, max, passed ? 1 : 0);
   #endif
   }
   ```

4. Build for WebGL. Then run:

   ```bash
   node packaging/pack-scorm.js \
     --activity my-unity-activity \
     --build path/to/Unity/Build/output \
     --engine unity
   ```

   *(`--engine unity` post-processing is sketched in `packaging/pack-scorm.js`. For Phase 1 you may need to manually adjust the wrapper HTML — see "Status" below.)*

## Godot 4 (web export)

Godot's web export exposes JS interop natively via the `JavaScriptBridge` singleton in GDScript or C#. No `.jslib` needed — call into the global `window.kukuiBridge` object directly. See the Godot manual under "Exporting for the Web" for the supported call patterns; the function name on `window` you target is `kukuiBridge.OnActivityComplete`.

Build with web export, then pack:

```bash
node packaging/pack-scorm.js --activity my-godot-activity --build path/to/godot/web-export --engine godot
```

## Articulate / Storyline / Captivate / iSpring

These tools already emit SCORM 1.2 calls (`cmi.core.score.raw`, `cmi.core.lesson_status`, `cmi.suspend_data`) directly. The bridge isn't strictly required — but `--engine articulate` keeps the manifest format consistent across the Kukui-packaged catalog.

```bash
node packaging/pack-scorm.js --activity my-storyline-export --build path/to/articulate/output --engine articulate
```

## Raw / hand-rolled HTML

For arbitrary HTML/JS content that doesn't fit any of the above, use `--engine raw`. Add a `<script>` tag pointing at the bridge module if you want the standard `window.kukuiBridge` surface:

```html
<script type="module">
  import "@kukui/bridge";
  // window.kukuiBridge is now attached
</script>
```

## Status

The `--engine` flag is parsed by `packaging/pack-scorm.js` today, but the per-engine processing for `unity`, `godot`, `articulate`, and `raw` is currently a stub that falls through to the `react` path. Expect the `unity` and `godot` flags to produce a zip whose `index.html` may need a small hand-edit to reference the engine's loader script.

Full per-engine packaging (auto-detect Unity Build/, auto-rewrite index.html for the engine's loader, etc.) is tracked under M7+ in the [Phase 1 implementation plan](./superpowers/plans/2026-05-05-engine-phase-1-plan.md).

## Why this matters

Kukui positions as a **content-engine-agnostic LMS adapter for Lamakū**, not a React-only ecosystem. The principal Phase 1 catalog is web-built; the bridge welcomes Unity, Godot, and Articulate authors as first-class citizens.

Faculty using Unity for heavy-3D anatomy interactives, student capstone teams shipping Godot educational games, vendors delivering Storyline content — they all upload SCORM zips to Lamakū the same way, and grades land in the D2L gradebook the same way.
