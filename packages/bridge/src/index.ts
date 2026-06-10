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
 * length-checks before writing and refuses an over-cap payload (warns,
 * returns false, keeps the previous value) — truncated JSON would fail to
 * parse on resume.
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
  RecordInteraction(json: string): boolean;
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

  const MAX_RESPONSE_CHARS = 255;
  const truncate = (s: string) =>
    s.length <= MAX_RESPONSE_CHARS ? s : s.slice(0, MAX_RESPONSE_CHARS - 1) + "…";
  const encodeLatency = (seconds: number): string => {
    const totalHundredths = Math.max(0, Math.floor(seconds * 100));
    const hundredths = totalHundredths % 100;
    const totalSec = Math.floor(totalHundredths / 100);
    const s = totalSec % 60;
    const m = Math.floor(totalSec / 60) % 60;
    const h = Math.floor(totalSec / 3600);
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const pad4 = (n: number) => String(n).padStart(4, "0");
    return `${pad4(h)}:${pad2(m)}:${pad2(s)}.${pad2(hundredths)}`;
  };
  const encodeTime = (d: Date) => {
    const pad2 = (n: number) => String(n).padStart(2, "0");
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  };
  let interactionIndex = 0;

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
        // SCORM 1.2 CMIDecimal score range is 0–100; clamp so an out-of-range
        // raw (bonus points, negative scoring) never produces an LMS write error.
        const scaled = max === 0 ? 0 : Math.min(100, Math.max(0, Math.round((raw / max) * 100)));
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
        // Never write a truncated payload — sliced JSON fails to parse on
        // resume, so the whole save would be lost. Keep the previous value.
        console.warn(
          `[kukui:bridge] suspend_data ${value.length} > ${SUSPEND_DATA_MAX} cap; skipping save to preserve the previous state`,
        );
        return false;
      }
      if (!connected || !scormApi) {
        memorySuspend = value;
        return false;
      }
      try {
        scormApi.set("cmi.suspend_data", value);
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

    RecordInteraction(json) {
      if (!connected || !scormApi) {
        console.info(`[kukui:bridge:preview] RecordInteraction: ${json}`);
        return false;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch (err) {
        console.error("[kukui:bridge] RecordInteraction: invalid JSON", err);
        return false;
      }
      // Validate the shape BEFORE any cmi.* write — the caller is a foreign
      // engine, so a malformed record must not leave a half-written
      // interaction behind.
      const record = parsed as {
        id: string;
        type: string;
        studentResponse: string;
        correctResponse?: string;
        result: { kind: string; value?: number };
        weighting?: number;
        latencySeconds?: number;
      };
      const resultKinds = ["correct", "wrong", "unanticipated", "neutral", "numeric"];
      const valid =
        typeof parsed === "object" &&
        parsed !== null &&
        typeof record.id === "string" &&
        typeof record.type === "string" &&
        typeof record.studentResponse === "string" &&
        typeof record.result === "object" &&
        record.result !== null &&
        resultKinds.includes(record.result.kind) &&
        (record.result.kind !== "numeric" || Number.isFinite(record.result.value)) &&
        (record.weighting === undefined || Number.isFinite(record.weighting)) &&
        (record.correctResponse === undefined || typeof record.correctResponse === "string") &&
        (record.latencySeconds === undefined || Number.isFinite(record.latencySeconds));
      if (!valid) {
        console.error("[kukui:bridge] RecordInteraction: malformed record", json);
        return false;
      }
      try {
        const i = interactionIndex;
        interactionIndex += 1;
        const prefix = `cmi.interactions.${i}`;
        // `id` is a CMIIdentifier — plain slice, no ellipsis: U+2026 is
        // outside the identifier character set. Human-readable responses
        // keep the marker.
        scormApi.set(`${prefix}.id`, record.id.slice(0, MAX_RESPONSE_CHARS));
        scormApi.set(`${prefix}.type`, record.type);
        scormApi.set(`${prefix}.time`, encodeTime(new Date()));
        scormApi.set(`${prefix}.student_response`, truncate(record.studentResponse));
        if (record.correctResponse !== undefined) {
          scormApi.set(`${prefix}.correct_responses.0.pattern`, truncate(record.correctResponse));
        }
        const result =
          record.result.kind === "numeric" && typeof record.result.value === "number"
            ? record.result.value.toFixed(2)
            : record.result.kind;
        scormApi.set(`${prefix}.result`, result);
        scormApi.set(`${prefix}.weighting`, String(record.weighting ?? 1));
        if (record.latencySeconds !== undefined) {
          scormApi.set(`${prefix}.latency`, encodeLatency(record.latencySeconds));
        }
        scormApi.save();
        return true;
      } catch (err) {
        console.error("[kukui:bridge] RecordInteraction failed:", err);
        return false;
      }
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
