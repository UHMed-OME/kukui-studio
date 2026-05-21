import type { ComponentType } from "react";

/**
 * Sidebar icon for the word-cloud activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): a cluster of differently-sized ellipses suggesting
 * weighted-tag layout.
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
    <ellipse cx="9" cy="12" rx="4" ry="2.5" />
    <ellipse cx="15.5" cy="8.5" rx="3" ry="1.8" />
    <ellipse cx="15" cy="15.5" rx="3.5" ry="2.2" />
    <ellipse cx="6" cy="17" rx="2" ry="1.2" />
  </svg>
);
