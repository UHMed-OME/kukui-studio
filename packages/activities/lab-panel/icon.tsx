import type { ComponentType } from "react";

/**
 * Sidebar icon for the lab-panel activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the shared
 * stroke-SVG family there (1.8px stroke, 24px viewBox, currentColor): a
 * laboratory test tube with a fill line — suggesting a lab-results panel.
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
    <path d="M9 3v13a3 3 0 0 0 6 0V3" />
    <line x1="8" y1="3" x2="16" y2="3" />
    <line x1="9" y1="12" x2="15" y2="12" />
  </svg>
);
