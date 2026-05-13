/**
 * Wipe every kukui-namespaced storage entry. Used by Settings → Reset all
 * to put the app back into a fully default state: no saved drafts, no
 * AI provider/key, no theme override, no transient session flags.
 *
 * The caller is expected to reload (or navigate away) immediately after,
 * so in-memory React state doesn't keep stale references to settings
 * that no longer exist on disk.
 */
export function clearAllKukuiStorage(): void {
  for (const storage of [localStorage, sessionStorage]) {
    // Collect first, then remove — removing while iterating shifts indices.
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith("kukui:")) keys.push(k);
    }
    for (const k of keys) storage.removeItem(k);
  }
}
