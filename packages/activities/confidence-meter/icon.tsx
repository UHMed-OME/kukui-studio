import type { ComponentType } from "react";

/**
 * Sidebar icon for the confidence-meter activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): a gauge baseline with a needle suggesting a dial /
 * meter reading.
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
    <line x1="4" y1="16" x2="20" y2="16" />
    <path d="M4 16 a8 8 0 0 1 16 0" />
    <line x1="12" y1="16" x2="17" y2="11" />
    <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);
