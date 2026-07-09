import LZString from "lz-string";
import {
  MAX_RESPONSE_CHARS,
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

/**
 * Measure a suspend payload against the SCORM 1.2 cap and warn when it's
 * over (or near) budget. All drivers call this — including the Memory and
 * Local drivers — so an author building a state-heavy activity hears about
 * the overflow in Studio preview / web mode instead of discovering broken
 * resume in the live LMS. Returns true when the payload fits.
 */
function checkSuspendBudget(json: string, context: string): boolean {
  const compressed = LZString.compressToUTF16(json);
  if (compressed.length > SUSPEND_DATA_MAX) {
    console.warn(
      `[kukui:scorm${context}] suspend_data ${compressed.length} > ${SUSPEND_DATA_MAX} cap; an LMS would reject this save and resume would keep the previous state`,
    );
    return false;
  }
  if (compressed.length > SUSPEND_DATA_MAX * 0.9) {
    console.warn(
      `[kukui:scorm${context}] suspend_data at ${compressed.length}/${SUSPEND_DATA_MAX} chars (compressed) — within 10% of the SCORM 1.2 cap`,
    );
  }
  return true;
}

/**
 * Which persistence backend a page wants.
 *   "lms"    — an LMS supplied a SCORM API; always wins when present.
 *   "web"    — no LMS, but persist + collect locally (LocalDriver).
 *   "memory" — dev / Studio preview / tests; nothing persists (MemoryDriver).
 * The actual driver is still chosen by capability first: if a SCORM API is on
 * the page we use it regardless of the requested mode.
 */
export type DriverMode = "lms" | "web" | "memory";

export interface ScormDriverOptions {
  mode?: DriverMode;
  /** localStorage namespace for "web" mode. Defaults to "kukui:web". */
  storageKey?: string;
}

/**
 * A learner's locally-stored run, surfaced to the web-mode completion panel
 * and the "download my results" affordance. Only LocalDriver populates this.
 */
export interface WebResults {
  score?: { raw: number; max: number; success: boolean };
  interactions: InteractionRecord[];
  name?: string;
  /** ISO-ish timestamp set when the score was last written. */
  finishedAt?: string;
}

export interface ScormDriver {
  initialize(): boolean;
  finish(): boolean;
  postScore(raw: number, max: number, success: boolean): void;
  saveSuspendData(json: string): void;
  loadSuspendData(): string | undefined;
  getStudentName(): string | undefined;
  getStudentId(): string | undefined;
  isLive(): boolean;
  recordInteraction(record: InteractionRecord): void;
  /** Web mode only — the locally-persisted run for the completion panel. */
  getWebResults?(): WebResults | undefined;
}

class PipwerksDriver implements ScormDriver {
  private interactionIndex = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(private readonly api: PipwerksScorm) {}
  initialize() {
    return this.api.init();
  }
  finish() {
    this.flushSave();
    return this.api.quit();
  }
  /**
   * Coalesce LMSCommit calls: activities persist on every state change, so
   * committing per write can mean dozens of LMSCommits a minute against
   * Brightspace. LMSSetValue still happens immediately (cheap, in-memory on
   * the LMS API side); only the commit is trailing-debounced. `finish()`
   * and every score/interaction write flush synchronously.
   */
  private scheduleSave() {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.api.save();
    }, 500);
  }
  private flushSave() {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.api.save();
  }
  postScore(raw: number, max: number, success: boolean) {
    const scaled = max === 0 ? 0 : (raw / max) * 100;
    // SCORM 1.2 CMIDecimal score range is 0–100; clamp so an out-of-range
    // raw (bonus points, negative scoring) never produces an LMS write error.
    const clamped = Math.min(100, Math.max(0, Math.round(scaled)));
    this.api.set("cmi.core.score.raw", String(clamped));
    this.api.set("cmi.core.score.min", "0");
    this.api.set("cmi.core.score.max", "100");
    this.api.set("cmi.core.lesson_status", success ? "passed" : "failed");
    this.flushSave();
  }
  saveSuspendData(json: string) {
    // Never truncate an LZ stream — a sliced stream decompresses to
    // garbage, so the whole save (and resume) would be lost. Keep the
    // last good value on the LMS instead.
    //
    // Transport note: compressToUTF16 emits code units > U+00FF, which some
    // SCORM 1.2 backends with Latin-1 CMIString handling would mangle
    // (corrupting the stream; the ""-on-corrupt guard in loadSuspendData
    // then silently drops resume). Brightspace — our only target LMS —
    // round-trips it fine. If another LMS ever becomes a target, switch to
    // compressToBase64 (~1.6x size but transport-safe).
    if (!checkSuspendBudget(json, "")) return;
    this.api.set("cmi.suspend_data", LZString.compressToUTF16(json));
    this.scheduleSave();
  }
  loadSuspendData(): string | undefined {
    const raw = this.api.get("cmi.suspend_data");
    if (!raw) return undefined;
    // `|| undefined` also maps "" to undefined: lz-string returns "" for
    // some corrupt inputs, and "" is never valid JSON for resume callers.
    const decompressed = LZString.decompressFromUTF16(raw);
    return decompressed || undefined;
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
    // `id` is a CMIIdentifier — plain slice, no ellipsis: U+2026 is outside
    // the identifier character set. Human-readable responses keep the marker.
    this.api.set(`${prefix}.id`, record.id.slice(0, MAX_RESPONSE_CHARS));
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
    this.flushSave();
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
    checkSuspendBudget(json, ":dev");
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

/**
 * Persists a learner's run to localStorage so progress survives reloads on
 * the same device — the backbone of the non-LMS "web" distribution. There is
 * no LMS API to post back to, so scores, suspend data, and interactions are
 * mirrored into a single namespaced record that the completion panel and the
 * "download my results" affordance read back out.
 *
 * If localStorage is unavailable (private mode, disabled cookies, SSR), the
 * record lives only in memory for the session — the activity still works,
 * it just won't resume after a reload. We never throw on storage failure.
 */
class LocalDriver implements ScormDriver {
  private record: WebResults = { interactions: [] };
  private suspend?: string;

  constructor(private readonly storageKey: string) {
    const raw = this.readStore();
    if (raw) {
      // readStore already type-checked every field — a tampered/legacy
      // record comes back sanitized (e.g. `interactions` is always an
      // array, which recordInteraction mutates).
      if (raw.results) this.record = raw.results;
      this.suspend = raw.suspend;
    }
  }

  private readStore(): { suspend?: string; results?: WebResults } | undefined {
    try {
      const text = window.localStorage.getItem(this.storageKey);
      if (!text) return undefined;
      const parsed: unknown = JSON.parse(text);
      // localStorage is learner-editable, so never trust the parsed shape.
      // Drop any field that fails a type check rather than crashing later
      // (suspend feeds JSON.parse in activities; score feeds arithmetic).
      if (typeof parsed !== "object" || parsed === null) return undefined;
      const record = parsed as { suspend?: unknown; results?: unknown };
      const out: { suspend?: string; results?: WebResults } = {};
      if (typeof record.suspend === "string") out.suspend = record.suspend;
      if (typeof record.results === "object" && record.results !== null) {
        const r = record.results as Record<string, unknown>;
        const results: WebResults = { interactions: [] };
        if (Array.isArray(r.interactions)) {
          results.interactions = r.interactions as InteractionRecord[];
        }
        const s = r.score as Record<string, unknown> | undefined;
        if (
          typeof s === "object" &&
          s !== null &&
          typeof s.raw === "number" &&
          typeof s.max === "number" &&
          typeof s.success === "boolean"
        ) {
          results.score = { raw: s.raw, max: s.max, success: s.success };
        }
        if (typeof r.name === "string") results.name = r.name;
        if (typeof r.finishedAt === "string") results.finishedAt = r.finishedAt;
        out.results = results;
      }
      return out;
    } catch {
      return undefined;
    }
  }

  private writeStore() {
    try {
      window.localStorage.setItem(
        this.storageKey,
        JSON.stringify({ suspend: this.suspend, results: this.record }),
      );
    } catch {
      // Quota or private-mode failure — keep the in-memory copy and move on.
    }
  }

  initialize() {
    return true;
  }
  finish() {
    return true;
  }
  postScore(raw: number, max: number, success: boolean) {
    // Unlike PipwerksDriver this stores raw/max unscaled — by design: web
    // completion codes and the results download carry raw points, and the
    // panel derives the percentage at display time.
    this.record.score = { raw, max, success };
    this.record.finishedAt = new Date().toISOString();
    this.writeStore();
  }
  saveSuspendData(json: string) {
    checkSuspendBudget(json, ":web");
    this.suspend = json;
    this.writeStore();
  }
  loadSuspendData() {
    return this.suspend;
  }
  getStudentName() {
    return this.record.name;
  }
  getStudentId() {
    return undefined;
  }
  isLive() {
    return false;
  }
  recordInteraction(record: InteractionRecord) {
    // De-dupe by id: the array persists across retries and reloads, so a
    // re-answered question replaces its prior record instead of appending
    // a duplicate forever.
    const existing = this.record.interactions.findIndex((r) => r.id === record.id);
    if (existing >= 0) {
      this.record.interactions[existing] = record;
    } else {
      this.record.interactions.push(record);
    }
    this.writeStore();
  }
  getWebResults(): WebResults {
    return this.record;
  }
}

/**
 * Stable localStorage namespace for a web-mode run on this page. Keyed by
 * activity kind, path, AND config URL — engine-web resolves the config from
 * a `?config=` query param, so two activities of the same kind served from
 * one path must not share state.
 */
export function webStorageKey(kind: string, configUrl: string): string {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  return `kukui:web:${kind}:${path}:${configUrl}`;
}

let driver: ScormDriver | undefined;

/**
 * Returns the active driver, instantiating once per page. Capability wins
 * over preference: a SCORM API on the page always selects PipwerksDriver,
 * even if `mode: "web"` was requested. Only the first call's options take
 * effect (the driver is a per-page singleton); later argless calls — e.g.
 * from ActivityHost's render — return the same instance.
 */
export function getScormDriver(opts?: ScormDriverOptions): ScormDriver {
  if (driver) return driver;
  const w = typeof window !== "undefined" ? (window as ScormWindow) : undefined;
  const api = w?.pipwerks?.SCORM;
  if (api) {
    const d = new PipwerksDriver(api);
    // LMSInitialize can fail (stale session, misconfigured LMS). Only commit
    // to the SCORM driver when it succeeds; otherwise fall through to the
    // requested non-LMS backend so saves don't silently no-op.
    if (d.initialize()) {
      driver = d;
      return driver;
    }
    console.warn("[kukui:scorm] LMSInitialize failed; falling back to non-LMS persistence");
  }
  if (opts?.mode === "web" && w) {
    const d = new LocalDriver(opts.storageKey ?? "kukui:web");
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
