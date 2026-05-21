import type { ComponentType } from "react";

/**
 * Sidebar icon for the quick-quiz activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): a list of options with one filled bullet, suggesting
 * the single-correct-answer multiple-choice shape.
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
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
    <line x1="7" y1="9" x2="11" y2="9" />
    <line x1="7" y1="13" x2="11" y2="13" />
    <line x1="7" y1="17" x2="11" y2="17" />
    <circle cx="14.5" cy="9" r="1.2" />
    <circle cx="14.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="17" r="1.2" />
  </svg>
);
