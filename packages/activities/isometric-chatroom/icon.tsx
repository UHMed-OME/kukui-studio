import type { ComponentType } from "react";

/**
 * Sidebar icon for the isometric-chatroom activity. Extracted from
 * apps/studio-app/src/activityIcons.tsx (LEGACY_ICONS). Matches the
 * shared stroke-SVG family there (1.8px stroke, 24px viewBox,
 * currentColor): two overlapping speech bubbles, suggesting the
 * multi-avatar chat shape.
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
    <path d="M3 4h12v8H8l-3 3v-3H3z" />
    <path d="M11 10h10v8h-3l-3 3v-3h-4z" />
  </svg>
);
