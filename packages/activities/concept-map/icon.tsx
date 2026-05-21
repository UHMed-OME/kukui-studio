import type { ComponentType } from "react";

/**
 * Sidebar icon for the concept-map activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the shared
 * stroke-SVG family there (1.8px stroke, 24px viewBox, currentColor):
 * three circles connected by lines — suggesting nodes joined by edges.
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
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="8" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <line x1="8" y1="7" x2="16" y2="8" />
    <line x1="7" y1="8" x2="11" y2="16" />
    <line x1="17" y1="10" x2="13" y2="16" />
  </svg>
);
