import type { ComponentType } from "react";

/**
 * Sidebar icon for the virtual-tour activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): an oval room with directional arrows suggesting
 * "walk around inside a 3D space."
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
    <ellipse cx="12" cy="12" rx="9" ry="4" />
    <polyline points="6 9 3 12 6 15" />
    <polyline points="18 9 21 12 18 15" />
  </svg>
);
