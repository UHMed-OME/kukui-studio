import type { ComponentType } from "react";

/**
 * Sidebar icon for the osce activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the shared
 * stroke-SVG family there (1.8px stroke, 24px viewBox, currentColor): a
 * clipboard with a check-marked checklist row above an underlined entry —
 * suggesting a clinical OSCE assessment checklist.
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
    <rect x="5" y="4" width="14" height="17" rx="1.5" />
    <rect x="9" y="2" width="6" height="3" rx="0.5" />
    <polyline points="8 11 10 13 13 9" />
    <line x1="15" y1="11" x2="17" y2="11" />
    <line x1="8" y1="16" x2="17" y2="16" />
  </svg>
);
