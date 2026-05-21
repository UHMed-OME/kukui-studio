import type { ComponentType } from "react";

/**
 * Sidebar icon for the ddx-tree activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the shared
 * stroke-SVG family there (1.8px stroke, 24px viewBox, currentColor): a
 * three-level node-tree fanning into four leaves — suggesting a clinical
 * decision tree branching toward terminal diagnoses.
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
    <circle cx="12" cy="3.5" r="1.5" />
    <circle cx="6" cy="11" r="1.5" />
    <circle cx="18" cy="11" r="1.5" />
    <circle cx="3" cy="20" r="1.5" />
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="15" cy="20" r="1.5" />
    <circle cx="21" cy="20" r="1.5" />
    <line x1="11" y1="4.5" x2="7" y2="10" />
    <line x1="13" y1="4.5" x2="17" y2="10" />
    <line x1="5" y1="12" x2="3.5" y2="18.5" />
    <line x1="7" y1="12" x2="8.5" y2="18.5" />
    <line x1="17" y1="12" x2="15.5" y2="18.5" />
    <line x1="19" y1="12" x2="20.5" y2="18.5" />
  </svg>
);
