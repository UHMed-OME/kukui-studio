/**
 * Typed read/write of `kukui:studio:ai-settings`. The AI editor uses the
 * user's own provider key — the key never leaves their browser. Storage is
 * either localStorage (persistent) or sessionStorage (this-session-only),
 * picked in the settings dialog.
 *
 * The shape also caches which `response_format` mode worked per
 * `(baseUrl, model)` pair so we don't re-probe the fallback chain on every
 * request.
 */
const KEY = "kukui:studio:ai-settings";
const MAX_BYTES = 256 * 1024;

export type OutputMode = "json_schema" | "json_object" | "free_text";

export type AISettings = {
  /** OpenAI-compatible base URL, e.g. `https://api.openai.com/v1`. */
  baseUrl: string;
  /** Model name, e.g. `gpt-4o-mini`. */
  model: string;
  /** Raw API key. Stored only in the browser. */
  apiKey: string;
  /** `local` = localStorage (persistent), `session` = sessionStorage. */
  storage: "local" | "session";
  /**
   * Cached output-mode capability per `${baseUrl}|${model}` key. Lets us
   * skip the probe on subsequent requests.
   */
  outputModeCache: Record<string, OutputMode>;
};

export const DEFAULT_SETTINGS: AISettings = {
  baseUrl: "",
  model: "",
  apiKey: "",
  storage: "local",
  outputModeCache: {},
};

/**
 * Pick the storage backing for the current settings: returns the one that
 * actually has a record, falling back to localStorage. Lets us keep the
 * `loadSettings` API parameterless while still honouring sessionStorage
 * when the user picked that option.
 */
function pickStorage(): { storage: Storage; which: "local" | "session" } | null {
  try {
    if (typeof window === "undefined") return null;
    const localRaw = window.localStorage.getItem(KEY);
    if (localRaw != null) return { storage: window.localStorage, which: "local" };
    const sessionRaw = window.sessionStorage.getItem(KEY);
    if (sessionRaw != null) return { storage: window.sessionStorage, which: "session" };
    return { storage: window.localStorage, which: "local" };
  } catch {
    return null;
  }
}

function isAISettings(v: unknown): v is AISettings {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.baseUrl === "string" &&
    typeof o.model === "string" &&
    typeof o.apiKey === "string" &&
    (o.storage === "local" || o.storage === "session") &&
    typeof o.outputModeCache === "object" &&
    o.outputModeCache !== null
  );
}

export function loadSettings(): AISettings {
  const pick = pickStorage();
  if (!pick) return { ...DEFAULT_SETTINGS };
  try {
    const raw = pick.storage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    if (raw.length > MAX_BYTES) {
      console.warn(`[kukui:studio:ai] settings exceed ${MAX_BYTES} bytes; ignoring.`);
      return { ...DEFAULT_SETTINGS };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isAISettings(parsed)) return { ...DEFAULT_SETTINGS };
    return parsed;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Write settings to whichever storage the user picked. Whenever the
 * storage choice changes, we wipe the *other* storage first so we don't
 * leave a stale copy around (avoids accidentally exfiltrating a key into
 * localStorage when the user explicitly chose "this session only").
 */
export function saveSettings(next: AISettings): void {
  if (typeof window === "undefined") return;
  try {
    const target = next.storage === "session" ? window.sessionStorage : window.localStorage;
    const other = next.storage === "session" ? window.localStorage : window.sessionStorage;
    other.removeItem(KEY);
    target.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("[kukui:studio:ai] failed to save settings:", err);
  }
}

export function clearSettings(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/** True when enough is configured to send a request. */
export function hasUsableSettings(s: AISettings): boolean {
  return s.apiKey.trim().length > 0 && s.baseUrl.trim().length > 0 && s.model.trim().length > 0;
}

/** Last 4 chars of the key, prefixed with bullets. Surface display only. */
export function maskKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return "•".repeat(trimmed.length);
  return "••••" + trimmed.slice(-4);
}

/** Stable cache key per (baseUrl, model). */
export function modeCacheKey(baseUrl: string, model: string): string {
  return `${baseUrl.trim()}|${model.trim()}`;
}

export function getCachedMode(s: AISettings, baseUrl: string, model: string): OutputMode | null {
  return s.outputModeCache[modeCacheKey(baseUrl, model)] ?? null;
}

export function setCachedMode(s: AISettings, baseUrl: string, model: string, mode: OutputMode): AISettings {
  return {
    ...s,
    outputModeCache: {
      ...s.outputModeCache,
      [modeCacheKey(baseUrl, model)]: mode,
    },
  };
}
