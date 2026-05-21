import type { ComponentType } from "react";

/**
 * Sidebar icon for the hotspot-3d activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): an isometric cube wireframe with a single highlighted
 * point suggesting "pick a 3D hotspot."
 */
export const Icon: ComponentType<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3l9 5v8l-9 5-9-5V8z" />
    <path d="M3 8l9 5 9-5" />
    <path d="M12 13v8" />
    <circle cx="12" cy="9" r="1" fill="currentColor" stroke="none" />
  </svg>
);
