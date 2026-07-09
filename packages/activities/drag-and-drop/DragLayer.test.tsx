import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DragEndEvent } from "@dnd-kit/core";

/**
 * Focused unit test for DragLayer.handleDragEnd — the drop-target
 * resolution that decides whether a dragged chip lands in a zone, goes
 * back to the tray, or snaps back.
 *
 * We stub @dnd-kit's DndContext so we can capture the `onDragEnd` handler
 * and fire synthetic DragEndEvents at it — no jsdom pointer geometry
 * needed. DnDActivity is stubbed to nothing so we exercise only the
 * handler wiring. Both mocks are file-scoped, so this lives in its own
 * test file (Component.test.tsx needs the real DndContext for its drag
 * regression test).
 */

let capturedOnDragEnd: ((e: DragEndEvent) => void) | undefined;

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    onDragEnd,
    children,
  }: {
    onDragEnd: (e: DragEndEvent) => void;
    children: ReactNode;
  }) => {
    capturedOnDragEnd = onDragEnd;
    return children;
  },
  useSensor: () => ({}),
  useSensors: () => [],
  PointerSensor: {},
  KeyboardSensor: {},
}));

vi.mock("./DnDActivity.js", () => ({
  DnDActivity: () => null,
}));

import { DragLayer } from "./DragLayer.js";

// DnDActivity is stubbed, so the activity props are never read.
const baseProps = {} as unknown as Parameters<typeof DragLayer>[0];

function fire(over: { id: string } | null) {
  capturedOnDragEnd?.({
    active: { id: "d-nucleus" },
    over,
  } as unknown as DragEndEvent);
}

describe("DragLayer — drag-end drop resolution", () => {
  beforeEach(() => {
    capturedOnDragEnd = undefined;
  });

  it("maps a drop on the tray to zoneId null (chip returns to the tray)", () => {
    const onPlace = vi.fn();
    render(<DragLayer {...baseProps} onPlace={onPlace} />);
    fire({ id: "tray" });
    expect(onPlace).toHaveBeenCalledWith("d-nucleus", null);
  });

  it("maps a drop on a zone to that zone id", () => {
    const onPlace = vi.fn();
    render(<DragLayer {...baseProps} onPlace={onPlace} />);
    fire({ id: "zone:z-nucleus" });
    expect(onPlace).toHaveBeenCalledWith("d-nucleus", "z-nucleus");
  });

  it("ignores a drop over nothing (chip snaps back, no dispatch)", () => {
    const onPlace = vi.fn();
    render(<DragLayer {...baseProps} onPlace={onPlace} />);
    fire(null);
    expect(onPlace).not.toHaveBeenCalled();
  });
});
