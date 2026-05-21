import type { ComponentType } from "react";

/**
 * Sidebar icon for the straw-poll activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): three bars of varying heights with translucent
 * fills, suggesting a bar-chart tally.
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
    <line x1="4" y1="20" x2="20" y2="20" />
    <rect x="5" y="14" width="3" height="6" fill="currentColor" stroke="none" opacity="0.22" />
    <rect x="5" y="14" width="3" height="6" />
    <rect x="10.5" y="9" width="3" height="11" fill="currentColor" stroke="none" opacity="0.22" />
    <rect x="10.5" y="9" width="3" height="11" />
    <rect x="16" y="12" width="3" height="8" fill="currentColor" stroke="none" opacity="0.22" />
    <rect x="16" y="12" width="3" height="8" />
  </svg>
);
