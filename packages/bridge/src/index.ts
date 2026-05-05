/**
 * @kukui/bridge — Phase 1.5 placeholder.
 *
 * The standalone JavaScript bridge that lets third-party content engines
 * (Unity, Godot, Articulate, etc.) integrate with Kukui's SCORM packaging
 * + D2L grade passback. Full implementation lands in M7.
 *
 * Planned API:
 *   window.kukuiBridge.OnActivityComplete(raw, max, success);
 *   window.kukuiBridge.SaveSuspendData(json);
 *   window.kukuiBridge.LoadSuspendData();
 *   window.kukuiBridge.GetUrlParam(key);
 */
export const KUKUI_BRIDGE_PLACEHOLDER = "kukui-bridge-not-yet-implemented" as const;
