import type { ComponentType } from "react";

/**
 * Sidebar icon for the qa-board activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): a speech-bubble with question-mark dot suggesting the
 * backchannel-question interaction.
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
    <path d="M3 5 h18 v10 h-7 l-4 3 v-3 H3z" />
    <line x1="7" y1="9" x2="13" y2="9" />
    <line x1="7" y1="12" x2="11" y2="12" />
    <circle cx="17.5" cy="9.5" r="0.7" fill="currentColor" stroke="none" />
    <line x1="16.5" y1="11.5" x2="16.5" y2="13" />
  </svg>
);
