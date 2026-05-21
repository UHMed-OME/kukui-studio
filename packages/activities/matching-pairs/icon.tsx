import type { ComponentType } from "react";

/**
 * Sidebar icon for the matching-pairs activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): two dots connected by a diagonal line, suggesting a
 * pair of items being matched across columns.
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
    <circle cx="5" cy="7" r="2.5" />
    <circle cx="19" cy="17" r="2.5" />
    <line x1="7" y1="8.5" x2="17" y2="15.5" />
  </svg>
);
