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

function ConfidenceMeterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <line x1="4" y1="16" x2="20" y2="16" />
      <path d="M4 16 a8 8 0 0 1 16 0" />
      <line x1="12" y1="16" x2="17" y2="11" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WordCloudIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <ellipse cx="9" cy="12" rx="4" ry="2.5" />
      <ellipse cx="15.5" cy="8.5" rx="3" ry="1.8" />
      <ellipse cx="15" cy="15.5" rx="3.5" ry="2.2" />
      <ellipse cx="6" cy="17" rx="2" ry="1.2" />
    </svg>
  );
}

function QABoardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3 5 h18 v10 h-7 l-4 3 v-3 H3z" />
      <line x1="7" y1="9" x2="13" y2="9" />
      <line x1="7" y1="12" x2="11" y2="12" />
      <circle cx="17.5" cy="9.5" r="0.7" fill="currentColor" stroke="none" />
      <line x1="16.5" y1="11.5" x2="16.5" y2="13" />
    </svg>
  );
}

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

function StrawPollIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="5" y="14" width="3" height="6" fill="currentColor" stroke="none" opacity="0.22" />
      <rect x="5" y="14" width="3" height="6" />
      <rect x="10.5" y="9" width="3" height="11" fill="currentColor" stroke="none" opacity="0.22" />
      <rect x="10.5" y="9" width="3" height="11" />
      <rect x="16" y="12" width="3" height="8" fill="currentColor" stroke="none" opacity="0.22" />
      <rect x="16" y="12" width="3" height="8" />
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
  "straw-poll": StrawPollIcon,
  "confidence-meter": ConfidenceMeterIcon,
  "word-cloud": WordCloudIcon,
  "qa-board": QABoardIcon,
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
