import type { ComponentType } from "react";

/**
 * Sidebar icon for the reflection-prompt activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): a speech bubble with a small sparkle inside,
 * suggesting a thoughtful written reflection.
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
    <path d="M4 5h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 4z" />
    <path
      d="M11 10l1-2 1 2 2 1-2 1-1 2-1-2-2-1z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);
