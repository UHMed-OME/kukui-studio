import type { ComponentType } from "react";

/**
 * Sidebar icon for the branching-scenario activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the shared
 * stroke-SVG family there (1.8px stroke, 24px viewBox, currentColor):
 * a Y-shaped decision tree — one node at the top branching into two
 * leaves — evoking a binary decision point.
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
    <circle cx="12" cy="5" r="2" />
    <circle cx="6" cy="17" r="2" />
    <circle cx="18" cy="17" r="2" />
    <line x1="11" y1="7" x2="7" y2="15" />
    <line x1="13" y1="7" x2="17" y2="15" />
  </svg>
);
