import { useState } from "react";
import type { DragAndDropConfig } from "@kukui/schemas";
import { chipColor } from "./DnDLinkOverlay.js";

/**
 * Side-panel chip authoring UI.
 *
 * Each row shows: drag-handle dot (color = chipColor(id)), label
 * (editable inline), and a chip-multi-select "Linked to" picker that
 * writes to correctZones.
 *
 * Selecting a row sets `selectedChipId` on the parent — the link
 * overlay then draws guide lines to that chip's zones. Clicking a
 * zone in the canvas (managed by the parent) selects that zone;
 * rows whose `correctZones` contain the selected zone get tinted.
 *
 * Inline warning: chips with `correctZones.length === 0` show
 * "This chip has nowhere correct to drop" in an aria-live region.
 * Schema rejects the chip ultimately, but the nudge fires during
 * mid-edit before the form's validation badge updates.
 */

type DnDChipPanelProps = {
  config: DragAndDropConfig;
  onChange: (next: DragAndDropConfig) => void;
  selectedChipId: string | null;
  onSelectChip: (id: string | null) => void;
  selectedZoneId: string | null;
};

type DraggableChip = DragAndDropConfig["draggables"][number];

function uniqueChipId(existing: string[]): string {
  let i = existing.length + 1;
  while (existing.includes(`d-${i}`)) i += 1;
  return `d-${i}`;
}

export function DnDChipPanel({
  config,
  onChange,
  selectedChipId,
  onSelectChip,
  selectedZoneId,
}: DnDChipPanelProps) {
  const [newChipLabel, setNewChipLabel] = useState("");

  const updateChip = (id: string, patch: Partial<DraggableChip>) => {
    onChange({
      ...config,
      draggables: config.draggables.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    });
  };

  const removeChip = (id: string) => {
    onChange({
      ...config,
      draggables: config.draggables.filter((d) => d.id !== id),
    });
    if (selectedChipId === id) onSelectChip(null);
  };

  const addChip = () => {
    const label = newChipLabel.trim();
    if (!label) return;
    const id = uniqueChipId(config.draggables.map((d) => d.id));
    const newChip: DraggableChip = {
      id,
      label,
      correctZones: [],
    };
    onChange({
      ...config,
      draggables: [...config.draggables, newChip],
    });
    setNewChipLabel("");
    onSelectChip(id);
  };

  const toggleZone = (chipId: string, zoneId: string) => {
    const chip = config.draggables.find((d) => d.id === chipId);
    if (!chip) return;
    const has = chip.correctZones.includes(zoneId);
    const next = has
      ? chip.correctZones.filter((z) => z !== zoneId)
      : [...chip.correctZones, zoneId];
    updateChip(chipId, { correctZones: next });
  };

  const handleDragStart =
    (chipId: string) =>
    (e: React.DragEvent<HTMLLIElement>): void => {
      e.dataTransfer.effectAllowed = "link";
      e.dataTransfer.setData("application/x-kukui-chip", chipId);
    };

  return (
    <aside className="ks-edit-dnd__panel" aria-label="Chips">
      <header className="ks-edit-dnd__panel-header">
        <h3 className="ks-edit-dnd__panel-title">Chips</h3>
        <p className="ks-edit-dnd__panel-help">
          Drag a chip onto a zone in the canvas to add the zone to its correct list, or use
          the picker below each chip. Selecting a chip highlights its target zones on the
          board.
        </p>
      </header>
      <ul className="ks-edit-dnd__chip-list">
        {config.draggables.map((chip) => {
          const isSelected = chip.id === selectedChipId;
          const isHighlighted =
            selectedZoneId !== null && chip.correctZones.includes(selectedZoneId);
          const hasNoTargets = chip.correctZones.length === 0;
          return (
            <li
              key={chip.id}
              className={[
                "ks-edit-dnd__chip-row",
                isSelected ? "is-selected" : "",
                isHighlighted ? "is-zone-target" : "",
                hasNoTargets ? "is-warning" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              draggable
              onDragStart={handleDragStart(chip.id)}
            >
              <button
                type="button"
                className="ks-edit-dnd__chip-row-handle"
                style={{ backgroundColor: chipColor(chip.id) }}
                onClick={() => onSelectChip(isSelected ? null : chip.id)}
                aria-label={isSelected ? `Deselect chip ${chip.label}` : `Select chip ${chip.label}`}
                aria-pressed={isSelected}
              />
              <div className="ks-edit-dnd__chip-row-body">
                <input
                  type="text"
                  className="ks-edit-dnd__chip-label-input"
                  value={chip.label}
                  onChange={(e) => updateChip(chip.id, { label: e.target.value })}
                  aria-label={`Chip ${chip.id} label`}
                  onFocus={() => onSelectChip(chip.id)}
                />
                <ZoneRefPicker
                  zones={config.dropZones}
                  selectedZoneIds={chip.correctZones}
                  onToggle={(zoneId) => toggleZone(chip.id, zoneId)}
                />
                {hasNoTargets ? (
                  <p
                    className="ks-edit-dnd__chip-row-warning"
                    role="status"
                    aria-live="polite"
                  >
                    This chip has nowhere correct to drop.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="ks-edit-dnd__chip-row-delete"
                onClick={() => removeChip(chip.id)}
                aria-label={`Delete chip ${chip.label}`}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="ks-edit-dnd__chip-add"
        onSubmit={(e) => {
          e.preventDefault();
          addChip();
        }}
      >
        <input
          type="text"
          className="ks-edit-dnd__chip-add-input"
          placeholder="New chip label"
          value={newChipLabel}
          onChange={(e) => setNewChipLabel(e.target.value)}
          aria-label="New chip label"
        />
        <button
          type="submit"
          className="ks-edit-dnd__chip-add-btn"
          disabled={!newChipLabel.trim()}
        >
          + Add chip
        </button>
      </form>
    </aside>
  );
}

/**
 * Compact multi-select for chip→zone linkage. Renders one button per
 * zone; click toggles. Empty state shows "No zones yet — draw one
 * on the canvas first" so authors aren't confused.
 */
function ZoneRefPicker({
  zones,
  selectedZoneIds,
  onToggle,
}: {
  zones: DragAndDropConfig["dropZones"];
  selectedZoneIds: string[];
  onToggle: (zoneId: string) => void;
}) {
  if (zones.length === 0) {
    return (
      <p className="ks-edit-dnd__zone-picker-empty">
        No zones yet — draw one on the canvas first.
      </p>
    );
  }
  return (
    <div className="ks-edit-dnd__zone-picker" role="group" aria-label="Correct zones">
      {zones.map((zone) => {
        const isOn = selectedZoneIds.includes(zone.id);
        return (
          <button
            key={zone.id}
            type="button"
            className={["ks-edit-dnd__zone-pill", isOn ? "is-on" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onToggle(zone.id)}
            aria-pressed={isOn}
            title={zone.label ?? zone.id}
          >
            {zone.label ?? zone.id}
          </button>
        );
      })}
    </div>
  );
}
