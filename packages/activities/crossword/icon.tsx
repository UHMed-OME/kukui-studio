import type { ComponentType } from "react";

/**
 * Sidebar icon for the crossword activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the shared
 * stroke-SVG family there (1.8px stroke, 24px viewBox, currentColor): a
 * 3×3 grid with two filled cells, evoking a crossword puzzle's mix of
 * letter cells and blocked squares.
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
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <rect x="3" y="9" width="6" height="6" fill="currentColor" stroke="none" opacity="0.18" />
    <rect x="15" y="3" width="6" height="6" fill="currentColor" stroke="none" opacity="0.18" />
  </svg>
);
