import type { ComponentType } from "react";

/**
 * Sidebar icon for the highlight-text activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): a highlighted middle line between two plain text lines,
 * suggesting "select / mark spans within a passage".
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
    <line x1="4" y1="6" x2="20" y2="6" />
    <rect x="3" y="10" width="18" height="4" rx="0.5" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);
