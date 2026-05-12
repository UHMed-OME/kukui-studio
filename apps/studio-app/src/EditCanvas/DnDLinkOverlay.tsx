import { useMemo } from "react";
import type { DragAndDropConfig } from "@kukui/schemas";

/**
 * SVG overlay that draws colored guide lines from a panel chip's
 * conceptual position to the center of each zone in its `correctZones`.
 *
 * Sits above the board zones but below their selection handles —
 * z-index 1 in CSS. Pointer events pass through so it doesn't
 * interfere with the geometry editor underneath.
 *
 * Two interaction directions:
 *  - selectedChipId !== null: highlight that chip's correct zones with
 *    a line from the side-panel chip row (approximate; the line
 *    originates from the right edge of the board, pointing to each
 *    target zone). Color is a deterministic hash of the chip ID.
 *  - selectedZoneId !== null: render a small "← targets" badge on
 *    each zone, plus tint chips in the panel that target this zone
 *    (that part lives in DnDChipPanel, not here).
 */

type DnDLinkOverlayProps = {
  config: DragAndDropConfig;
  selectedChipId: string | null;
  selectedZoneId: string | null;
};

/**
 * Deterministic chip-id → hue mapping. Same chip always gets the same
 * color across renders. Uses a small FNV-style hash to keep adjacent
 * chip IDs visually distinct.
 */
function chipColor(chipId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < chipId.length; i++) {
    hash ^= chipId.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 70% 45%)`;
}

export function DnDLinkOverlay({
  config,
  selectedChipId,
  selectedZoneId,
}: DnDLinkOverlayProps) {
  // For the chip selection: draw lines from a virtual origin at the
  // right edge of the board (where the side panel meets it) to the
  // centroid of each target zone. The geometry is in normalized
  // coordinates so it scales with the board.
  const chip = useMemo(
    () => (selectedChipId ? config.draggables.find((d) => d.id === selectedChipId) : null),
    [selectedChipId, config.draggables],
  );

  const targets = useMemo(() => {
    if (!chip) return [] as Array<{ id: string; cx: number; cy: number }>;
    return chip.correctZones
      .map((zoneId) => {
        const z = config.dropZones.find((z) => z.id === zoneId);
        if (!z) return null;
        return {
          id: z.id,
          cx: z.rect.x + z.rect.w / 2,
          cy: z.rect.y + z.rect.h / 2,
        };
      })
      .filter((t): t is { id: string; cx: number; cy: number } => t !== null);
  }, [chip, config.dropZones]);

  // For zone selection: highlight chips targeting this zone happens
  // in the panel; here we just emphasize the selected zone with a
  // small marker ring that sits ON the board.
  const zoneMarker = useMemo(() => {
    if (!selectedZoneId) return null;
    const z = config.dropZones.find((zz) => zz.id === selectedZoneId);
    if (!z) return null;
    return {
      cx: z.rect.x + z.rect.w / 2,
      cy: z.rect.y + z.rect.h / 2,
    };
  }, [selectedZoneId, config.dropZones]);

  if (!chip && !zoneMarker) return null;

  const color = chip ? chipColor(chip.id) : "var(--color-primary)";

  return (
    <svg
      className="ks-edit-dnd__link-overlay"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {chip && targets.length > 0 ? (
        <g>
          {targets.map((t) => (
            <g key={t.id}>
              {/* Line from the right edge (chip's panel side) to the
                  zone's centroid. The exit point is at the board's
                  right edge at the same Y as the target. */}
              <line
                x1={100}
                y1={t.cy * 100}
                x2={t.cx * 100}
                y2={t.cy * 100}
                stroke={color}
                strokeWidth={0.6}
                strokeDasharray="2 1"
                vectorEffect="non-scaling-stroke"
              />
              {/* Dot at the target zone's centroid. */}
              <circle
                cx={t.cx * 100}
                cy={t.cy * 100}
                r={1.5}
                fill={color}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </g>
      ) : null}
      {zoneMarker ? (
        <circle
          cx={zoneMarker.cx * 100}
          cy={zoneMarker.cy * 100}
          r={2.5}
          fill="none"
          stroke={color}
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}

export { chipColor };
