/**
 * Catalog of planned activity kinds — listed in Studio so authors see
 * what's coming, even before each implementation lands.
 *
 * Currently empty: every spec'd activity has shipped. New entries land
 * here when the Notion taxonomy adds future activity kinds we want
 * authors to see in Studio's "Coming soon" group ahead of implementation.
 */
export const PLANNED_ACTIVITY_KINDS = [] as const;

export type PlannedActivityKind = (typeof PLANNED_ACTIVITY_KINDS)[number];

export const PLANNED_LABELS: Record<PlannedActivityKind, string> = {};
export const PLANNED_DESCRIPTIONS: Record<PlannedActivityKind, string> = {};
