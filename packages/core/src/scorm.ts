import LZString from "lz-string";
import {
  encodeLatency,
  encodeResult,
  encodeTimeOfDay,
  truncateResponse,
} from "./interaction-encoding.js";
import type { InteractionRecord } from "./types.js";

/**
 * SCORM 1.2 wrapper. Discovers the SCORM API on the page (set up by the
 * surrounding HTML wrapper via pipwerks), and exposes a small typed surface
 * for the activities. Falls back to an in-memory shim outside SCORM (dev,
 * tests, Studio preview).
 *
 * SCORM 1.2 limits:
 *   cmi.suspend_data: 4096 chars (we LZ-compress before write)
 *   cmi.core.lesson_status: passed | completed | failed | incomplete | browsed | not attempted
 */

type PipwerksScorm = {
  init: () => boolean;
  get: (key: string) => string;
  set: (key: string, value: string) => boolean;
  save: () => boolean;
  quit: () => boolean;
  status: (action: "get" | "set", value?: string) => string | boolean;
};

type ScormWindow = Window & {
  pipwerks?: { SCORM?: PipwerksScorm };
};

const SUSPEND_DATA_MAX = 4096;

export interface ScormDriver {
  initialize(): boolean;
  finish(): boolean;
  postScore(raw: number, max: number, success: boolean): void;
  saveSuspendData(json: string): void;
  loadSuspendData(): string | undefined;
  setStudentName?(): string | undefined;
  getStudentName(): string | undefined;
  getStudentId(): string | undefined;
  isLive(): boolean;
  recordInteraction(record: InteractionRecord): void;
}

class PipwerksDriver implements ScormDriver {
  private interactionIndex = 0;
  constructor(private readonly api: PipwerksScorm) {}
  initialize() {
    return this.api.init();
  }
  finish() {
    return this.api.quit();
  }
  postScore(raw: number, max: number, success: boolean) {
    const scaled = max === 0 ? 0 : (raw / max) * 100;
    this.api.set("cmi.core.score.raw", String(Math.round(scaled)));
    this.api.set("cmi.core.score.min", "0");
    this.api.set("cmi.core.score.max", "100");
    this.api.set("cmi.core.lesson_status", success ? "passed" : "failed");
    this.api.save();
  }
  saveSuspendData(json: string) {
    const compressed = LZString.compressToUTF16(json);
    if (compressed.length > SUSPEND_DATA_MAX) {
      console.warn(
        `[kukui:scorm] suspend_data ${compressed.length} > ${SUSPEND_DATA_MAX} cap; truncating`,
      );
    }
    this.api.set("cmi.suspend_data", compressed.slice(0, SUSPEND_DATA_MAX));
    this.api.save();
  }
  loadSuspendData(): string | undefined {
    const raw = this.api.get("cmi.suspend_data");
    if (!raw) return undefined;
    const decompressed = LZString.decompressFromUTF16(raw);
    return decompressed ?? undefined;
  }
  getStudentName(): string | undefined {
    const v = this.api.get("cmi.core.student_name");
    return v || undefined;
  }
  getStudentId(): string | undefined {
    const v = this.api.get("cmi.core.student_id");
    return v || undefined;
  }
  isLive() {
    return true;
  }
  recordInteraction(record: InteractionRecord) {
    const i = this.interactionIndex;
    this.interactionIndex += 1;
    const prefix = `cmi.interactions.${i}`;
    this.api.set(`${prefix}.id`, truncateResponse(record.id));
    this.api.set(`${prefix}.type`, record.type);
    this.api.set(`${prefix}.time`, encodeTimeOfDay(new Date()));
    this.api.set(`${prefix}.student_response`, truncateResponse(record.studentResponse));
    if (record.correctResponse !== undefined) {
      this.api.set(`${prefix}.correct_responses.0.pattern`, truncateResponse(record.correctResponse));
    }
    this.api.set(`${prefix}.result`, encodeResult(record.result));
    this.api.set(`${prefix}.weighting`, String(record.weighting ?? 1));
    if (record.latencySeconds !== undefined) {
      this.api.set(`${prefix}.latency`, encodeLatency(record.latencySeconds));
    }
    this.api.save();
  }
}

class MemoryDriver implements ScormDriver {
  private suspend?: string;
  initialize() {
    return true;
  }
  finish() {
    return true;
  }
  postScore(raw: number, max: number, success: boolean) {
    console.info(`[kukui:scorm:dev] score ${raw}/${max} ${success ? "passed" : "failed"}`);
  }
  saveSuspendData(json: string) {
    this.suspend = json;
  }
  loadSuspendData() {
    return this.suspend;
  }
  getStudentName() {
    return undefined;
  }
  getStudentId() {
    return undefined;
  }
  isLive() {
    return false;
  }
  recordInteraction(record: InteractionRecord) {
    console.info(
      `[kukui:scorm:dev] interaction ${record.id} → "${record.studentResponse}" (${record.result.kind})`,
    );
  }
}

let driver: ScormDriver | undefined;

/** Returns the active SCORM driver, instantiating once per page. */
export function getScormDriver(): ScormDriver {
  if (driver) return driver;
  const w = typeof window !== "undefined" ? (window as ScormWindow) : undefined;
  const api = w?.pipwerks?.SCORM;
  if (api) {
    const d = new PipwerksDriver(api);
    d.initialize();
    driver = d;
  } else {
    driver = new MemoryDriver();
  }
  return driver;
}

/** Test-only: replace the driver with a stub. */
export function __setScormDriverForTest(d: ScormDriver | undefined) {
  driver = d;
}
