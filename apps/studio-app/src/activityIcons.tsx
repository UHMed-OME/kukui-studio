/**
 * Resolves a Studio-surfaced activity kind to its manifest-supplied icon.
 *
 * Icons live alongside each activity in `@kukui/activities/{slug}/`. When no
 * icon is registered for a kind, <ActivityIcon> renders a 16×16 invisible
 * placeholder so the sidebar button's flex layout never collapses.
 */
import type { ActivityKind } from "@kukui/core";
import { ACTIVITY_MANIFESTS } from "@kukui/activities";

export function ActivityIcon({
  kind,
  className,
}: {
  kind: ActivityKind;
  className?: string;
}) {
  const ManifestIcon = ACTIVITY_MANIFESTS[kind]?.Icon;
  if (ManifestIcon) return <ManifestIcon className={className} />;
  return <span className={className} aria-hidden="true" />;
}

export function hasActivityIcon(kind: ActivityKind): boolean {
  return Boolean(ACTIVITY_MANIFESTS[kind]?.Icon);
}
