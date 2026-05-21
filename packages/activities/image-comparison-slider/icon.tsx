import type { ComponentType } from "react";

/**
 * Sidebar icon for the image-comparison-slider activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the shared
 * stroke-SVG family there (1.8px stroke, 24px viewBox, currentColor): a
 * framed rectangle bisected by a vertical seam with chevrons on either
 * side, suggesting "drag the seam to compare two images".
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
    <rect x="3" y="5" width="18" height="14" rx="1" />
    <line x1="12" y1="3" x2="12" y2="21" />
    <polyline points="9 10 7 12 9 14" />
    <polyline points="15 10 17 12 15 14" />
  </svg>
);
