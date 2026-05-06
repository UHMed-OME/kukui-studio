/**
 * @kukui/bridge — standalone JavaScript bridge for third-party content engines
 * (Unity WebGL, Godot 4 web export, Articulate, etc.) integrating with Kukui's
 * SCORM 1.2 packaging + D2L grade passback.
 *
 * Importing this module attaches `window.kukuiBridge` with five methods:
 *
 *   window.kukuiBridge.OnActivityComplete(raw, max, success);
 *   window.kukuiBridge.SaveSuspendData(json);
 *   window.kukuiBridge.LoadSuspendData();
 *   window.kukuiBridge.GetUrlParam(key);
 *   window.kukuiBridge.IsConnected();
 *
 * The bridge expects pipwerks.SCORM (loaded by the SCORM zip's wrapper) on
 * the page. When pipwerks isn't present (preview mode), it falls back to an
 * in-memory shim and logs a warning. Tear-down on `pagehide` /
 * `beforeunload` calls LMSFinish exactly once.
 *
 * SCORM 1.2 cmi.suspend_data has a 4096-character cap — `SaveSuspendData`
 * length-checks before writing and warns on overflow.
 */

const SUSPEND_DATA_MAX = 4096;

type PipwerksScorm = {
  init: () => boolean;
  get: (key: string) => string;
  set: (key: string, value: string) => boolean;
  save: () => boolean;
  quit: () => boolean;
};

type PipwerksGlobal = { SCORM?: PipwerksScorm };

export interface KukuiBridge {
  OnActivityComplete(raw: number, max: number, success: boolean | number): boolean;
  SaveSuspendData(json: string): boolean;
  LoadSuspendData(): string;
  GetUrlParam(key: string): string;
  IsConnected(): boolean;
}

declare global {
  interface Window {
    kukuiBridge?: KukuiBridge;
    pipwerks?: PipwerksGlobal;
  }
}

let scormApi: PipwerksScorm | null = null;
let connected = false;
let memorySuspend = "";
let teardownDone = false;

function asNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
  return Boolean(v);
}

export function attachBridge(target: Window = window): KukuiBridge {
  if (target.kukuiBridge) return target.kukuiBridge;

  scormApi = target.pipwerks?.SCORM ?? null;
  if (scormApi) {
    try {
      connected = !!scormApi.init();
    } catch (err) {
      console.warn("[kukui:bridge] pipwerks.SCORM.init threw:", err);
      connected = false;
    }
  } else {
    connected = false;
  }
  if (!connected) {
    console.info("[kukui:bridge] SCORM API not available — running in preview mode.");
  }

  const bridge: KukuiBridge = {
    OnActivityComplete(rawIn, maxIn, successIn) {
      const raw = asNumber(rawIn);
      const max = asNumber(maxIn);
      const success = asBool(successIn);
      if (!connected || !scormApi) {
        console.info(
          `[kukui:bridge:preview] OnActivityComplete raw=${raw} max=${max} success=${success}`,
        );
        return false;
      }
      try {
        const scaled = max === 0 ? 0 : Math.round((raw / max) * 100);
        scormApi.set("cmi.core.score.raw", String(scaled));
        scormApi.set("cmi.core.score.min", "0");
        scormApi.set("cmi.core.score.max", "100");
        scormApi.set("cmi.core.lesson_status", success ? "passed" : "failed");
        scormApi.save();
        return true;
      } catch (err) {
        console.error("[kukui:bridge] OnActivityComplete failed:", err);
        return false;
      }
    },

    SaveSuspendData(json) {
      const value = typeof json === "string" ? json : "";
      if (value.length > SUSPEND_DATA_MAX) {
        console.warn(
          `[kukui:bridge] suspend_data ${value.length} > ${SUSPEND_DATA_MAX} cap; truncating`,
        );
      }
      const truncated = value.slice(0, SUSPEND_DATA_MAX);
      if (!connected || !scormApi) {
        memorySuspend = truncated;
        return false;
      }
      try {
        scormApi.set("cmi.suspend_data", truncated);
        scormApi.save();
        return true;
      } catch (err) {
        console.error("[kukui:bridge] SaveSuspendData failed:", err);
        return false;
      }
    },

    LoadSuspendData() {
      if (!connected || !scormApi) return memorySuspend;
      try {
        return scormApi.get("cmi.suspend_data") ?? "";
      } catch (err) {
        console.error("[kukui:bridge] LoadSuspendData failed:", err);
        return "";
      }
    },

    GetUrlParam(key) {
      if (typeof key !== "string" || !key) return "";
      try {
        const params = new URLSearchParams(target.location.search);
        return params.get(key) ?? "";
      } catch {
        return "";
      }
    },

    IsConnected() {
      return connected;
    },
  };

  // Tear down on page hide. Idempotent — guards against double-finish.
  const teardown = () => {
    if (teardownDone) return;
    teardownDone = true;
    if (connected && scormApi) {
      try {
        scormApi.quit();
      } catch (err) {
        console.warn("[kukui:bridge] LMSFinish threw:", err);
      }
    }
  };
  target.addEventListener("pagehide", teardown);
  target.addEventListener("beforeunload", teardown);

  target.kukuiBridge = bridge;
  return bridge;
}

/** Test seam: reset module state so attachBridge() reattaches fresh. */
export function __resetBridgeForTest(target: Window = window): void {
  scormApi = null;
  connected = false;
  memorySuspend = "";
  teardownDone = false;
  if (target.kukuiBridge) delete target.kukuiBridge;
}

// Auto-attach when imported in a browser-like environment.
if (typeof window !== "undefined") {
  attachBridge(window);
}
