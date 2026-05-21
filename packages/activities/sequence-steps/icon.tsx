import type { ComponentType } from "react";

/**
 * Sidebar icon for the sequence-steps activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): three numbered nodes connected by short diagonal
 * lines, suggesting an ordered chain of steps.
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
    <circle cx="5" cy="6" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="18" r="2" />
    <line x1="6.5" y1="7.5" x2="10.5" y2="10.5" />
    <line x1="13.5" y1="13.5" x2="17.5" y2="16.5" />
  </svg>
);
