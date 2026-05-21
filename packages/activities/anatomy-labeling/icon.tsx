import type { ComponentType } from "react";

/**
 * Sidebar icon for the anatomy-labeling activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): a stick figure with a label leader line and a small
 * tag, suggesting "label a part of the body".
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
    <circle cx="9" cy="6" r="2.5" />
    <path d="M9 9v6" />
    <path d="M6 13l3-2 3 2" />
    <path d="M7 20l2-3 2 3" />
    <line x1="13" y1="6" x2="17" y2="6" />
    <rect x="17" y="4" width="4" height="4" rx="0.5" />
  </svg>
);
