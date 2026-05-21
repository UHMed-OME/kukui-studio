/**
 * One small stroke-SVG icon per Studio-surfaced activity kind. Style matches
 * `./icons.tsx` (1.8px stroke, 24px viewBox, currentColor) so the sidebar
 * iconography reads as one family with the toolbar icons.
 *
 * Icons are concepts, not literal pictograms — each suggests the activity's
 * interaction style at 16×16 (drag arrow, target dot, tree fork, etc.).
 *
 * <ActivityIcon> renders a 16×16 invisible placeholder when no icon is
 * registered for a kind, so a missing icon never collapses the sidebar
 * button's flex layout.
 */
import type { JSX, SVGProps } from "react";
import type { ActivityKind } from "@kukui/core";
import { ACTIVITY_MANIFESTS } from "@kukui/activities";

const baseProps: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function QuickQuizIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
      <line x1="7" y1="9" x2="11" y2="9" />
      <line x1="7" y1="13" x2="11" y2="13" />
      <line x1="7" y1="17" x2="11" y2="17" />
      <circle cx="14.5" cy="9" r="1.2" />
      <circle cx="14.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="17" r="1.2" />
    </svg>
  );
}

function IsometricChatroomIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3 4h12v8H8l-3 3v-3H3z" />
      <path d="M11 10h10v8h-3l-3 3v-3h-4z" />
    </svg>
  );
}

type IconComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element;

const LEGACY_ICONS: Partial<Record<ActivityKind, IconComponent>> = {
  "quick-quiz": QuickQuizIcon,
  "isometric-chatroom": IsometricChatroomIcon,
};

export function hasActivityIcon(kind: ActivityKind): boolean {
  return Boolean(ACTIVITY_MANIFESTS[kind]?.Icon || LEGACY_ICONS[kind]);
}

export function ActivityIcon({
  kind,
  ...rest
}: { kind: ActivityKind } & SVGProps<SVGSVGElement>) {
  // Prefer manifest-supplied icon (Plan 1+) over the hand-written legacy map.
  const ManifestIcon = ACTIVITY_MANIFESTS[kind]?.Icon;
  if (ManifestIcon) {
    return <ManifestIcon className={rest.className} />;
  }
  const LegacyIcon = LEGACY_ICONS[kind];
  if (LegacyIcon) {
    return <LegacyIcon {...rest} />;
  }
  // No icon registered — render the same invisible 16×16 placeholder the
  // file header promises so missing icons never collapse the sidebar's
  // flex layout.
  return (
    <span
      aria-hidden="true"
      className={rest.className}
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        flex: "0 0 16px",
      }}
    />
  );
}
