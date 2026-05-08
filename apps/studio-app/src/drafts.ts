/**
 * localStorage-backed draft storage. One draft per activity kind. The user
 * can switch between activities and each keeps its in-progress state.
 *
 * Drafts are not Zod-validated on load — the form layer expects to receive
 * partial / in-progress configs (e.g. an empty title before the user
 * types). Boundaries we DO enforce here:
 *  - max 2 MB per draft (an attacker / errant extension can't crash the
 *    tab by stuffing a huge blob in)
 *  - JSON.parse failures swallowed (returns null), so a corrupted entry
 *    never blows up app boot
 */
const PREFIX = "kukui:studio:draft:";
const MAX_DRAFT_BYTES = 2 * 1024 * 1024;

export function loadDraft(kind: string): unknown | null {
  try {
    const raw = localStorage.getItem(PREFIX + kind);
    if (!raw) return null;
    if (raw.length > MAX_DRAFT_BYTES) {
      console.warn(`[kukui:studio] draft for ${kind} exceeds ${MAX_DRAFT_BYTES} bytes; ignoring.`);
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveDraft(kind: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + kind, JSON.stringify(value));
  } catch (err) {
    console.warn("[kukui:studio] failed to save draft:", err);
  }
}

export function clearDraft(kind: string): void {
  try {
    localStorage.removeItem(PREFIX + kind);
  } catch {
    /* noop */
  }
}

/** Auto-save: debounced wrapper. */
export function debouncedSaver(kind: string, delayMs = 400): (value: unknown) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (value: unknown) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveDraft(kind, value), delayMs);
  };
}
