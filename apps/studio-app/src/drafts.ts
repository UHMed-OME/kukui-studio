/**
 * localStorage-backed draft storage. One draft per activity kind. The user
 * can switch between activities and each keeps its in-progress state.
 */
const PREFIX = "kukui:studio:draft:";

export function loadDraft(kind: string): unknown | null {
  try {
    const raw = localStorage.getItem(PREFIX + kind);
    return raw ? JSON.parse(raw) : null;
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
