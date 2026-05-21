import type { ComponentType } from "react";

/**
 * Sidebar icon for the categorization activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): a top shelf above three bins, suggesting items being
 * sorted into category containers.
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
    <path d="M3 4v3" />
    <path d="M3 4h18" />
    <path d="M21 4v3" />
    <rect x="3" y="11" width="5" height="9" rx="0.5" />
    <rect x="9.5" y="11" width="5" height="9" rx="0.5" />
    <rect x="16" y="11" width="5" height="9" rx="0.5" />
  </svg>
);
