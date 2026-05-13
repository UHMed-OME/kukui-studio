import { useEffect, useState } from "react";

/**
 * Reads the resolved color scheme from `<html data-color-scheme>` and
 * stays in sync as the attribute changes. The attribute is owned by
 * `@kukui/core`'s `colorScheme.ts`: it flips when the user picks a
 * preference in Settings → Appearance, or when the OS theme changes
 * while the stored preference is "system".
 *
 * Lives in studio-app (not @kukui/core) to keep React out of engine-web's
 * bundle — engine-web imports the imperative `initColorScheme` from
 * core but doesn't need any React hook.
 */
export function useResolvedColorScheme(): "light" | "dark" {
  const [scheme, setScheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.dataset.colorScheme === "dark"
      ? "dark"
      : "light";
  });

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const html = document.documentElement;
    const observer = new MutationObserver(() => {
      setScheme(html.dataset.colorScheme === "dark" ? "dark" : "light");
    });
    observer.observe(html, {
      attributes: true,
      attributeFilter: ["data-color-scheme"],
    });
    return () => observer.disconnect();
  }, []);

  return scheme;
}
