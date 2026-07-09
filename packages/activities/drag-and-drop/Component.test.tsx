import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DragAndDropConfig } from "@kukui/schemas";
import Component from "./Component.js";

/**
 * NOTE on interaction mode in tests:
 *
 * `useInteractionMode` defaults to "drag" on desktop widths and only
 * flips to "tap" on the first touch pointermove. jsdom reports
 * window.innerWidth of 1024 by default — well above the 760 px mobile
 * breakpoint — so without an override the runtime mounts the
 * DragLayer (DndContext).
 *
 * For tap-to-place tests we set `behaviour.interaction: "tap"` on the
 * config so the runtime mounts TapLayer regardless of the pointer-event
 * heuristics. For the drag regression test we leave it unset (auto +
 * desktop width = drag).
 */

const cfg: DragAndDropConfig = {
  version: "1.0",
  title: "Plant cell",
  background: { src: "https://example.com/plant-cell.png", alt: "Plant cell" },
  draggables: [
    { id: "d-nucleus", label: "Nucleus", correctZones: ["z-nucleus"] },
    { id: "d-chloroplast", label: "Chloroplast", correctZones: ["z-chloroplast"] },
  ],
  dropZones: [
    { id: "z-nucleus", label: "Nucleus zone", rect: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 } },
    {
      id: "z-chloroplast",
      label: "Chloroplast zone",
      rect: { x: 0.65, y: 0.55, w: 0.15, h: 0.15 },
    },
  ],
  behaviour: { enableRetry: true },
};

const tapCfg: DragAndDropConfig = {
  ...cfg,
  behaviour: { ...cfg.behaviour, interaction: "tap" },
};

describe("DragAndDrop — tap-to-place flow", () => {
  it("renders board heading + tray chips + check button", () => {
    render(<Component config={tapCfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /plant cell/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^nucleus$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^chloroplast$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check/i })).toBeDisabled();
  });

  it("tap chip → tap zone places the chip", async () => {
    const user = userEvent.setup();
    render(<Component config={tapCfg} onSubmit={vi.fn()} />);
    const chip = screen.getByRole("button", { name: /^nucleus$/i });
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    const zone = screen.getByRole("button", { name: /nucleus zone/i });
    await user.click(zone);
    // After placement, the chip moves inside the zone — re-query inside it.
    const placed = within(zone).queryByText("Nucleus");
    expect(placed).not.toBeNull();
  });

  it("keyboard: Space selects chip, Space on zone places it", async () => {
    const user = userEvent.setup();
    render(<Component config={tapCfg} onSubmit={vi.fn()} />);
    const chip = screen.getByRole("button", { name: /^nucleus$/i });
    chip.focus();
    await user.keyboard(" ");
    expect(chip).toHaveAttribute("aria-pressed", "true");
    const zone = screen.getByRole("button", { name: /nucleus zone/i });
    zone.focus();
    await user.keyboard(" ");
    const placed = within(zone).queryByText("Nucleus");
    expect(placed).not.toBeNull();
  });

  it("Check is disabled until every chip is placed", async () => {
    const user = userEvent.setup();
    render(<Component config={tapCfg} onSubmit={vi.fn()} />);
    const check = screen.getByRole("button", { name: /check/i });
    expect(check).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^nucleus$/i }));
    await user.click(screen.getByRole("button", { name: /nucleus zone/i }));
    expect(check).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^chloroplast$/i }));
    await user.click(screen.getByRole("button", { name: /chloroplast zone/i }));
    expect(check).toBeEnabled();
  });

  it("all-correct placements score full marks", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={tapCfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^nucleus$/i }));
    await user.click(screen.getByRole("button", { name: /nucleus zone/i }));
    await user.click(screen.getByRole("button", { name: /^chloroplast$/i }));
    await user.click(screen.getByRole("button", { name: /chloroplast zone/i }));
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 2, max: 2, success: true });
  });

  it("Try again resets all placements", async () => {
    const user = userEvent.setup();
    render(<Component config={tapCfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^nucleus$/i }));
    await user.click(screen.getByRole("button", { name: /nucleus zone/i }));
    await user.click(screen.getByRole("button", { name: /^chloroplast$/i }));
    await user.click(screen.getByRole("button", { name: /chloroplast zone/i }));
    await user.click(screen.getByRole("button", { name: /check/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    const checkAgain = screen.getByRole("button", { name: /check/i });
    expect(checkAgain).toBeDisabled();
    // Chips are back in the tray.
    expect(screen.getByRole("button", { name: /^nucleus$/i })).toBeInTheDocument();
  });

  it("respects zone capacity (default 1) — second chip can't enter the same zone", async () => {
    const user = userEvent.setup();
    render(<Component config={tapCfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^nucleus$/i }));
    await user.click(screen.getByRole("button", { name: /nucleus zone/i }));
    // Now try to place the second chip into the same zone.
    await user.click(screen.getByRole("button", { name: /^chloroplast$/i }));
    await user.click(screen.getByRole("button", { name: /nucleus zone/i }));
    // Chloroplast must still be in the tray — it's still a top-level button.
    const stillSelected = screen.getByRole("button", { name: /^chloroplast$/i });
    // Its aria-pressed should remain true; placement was rejected.
    expect(stillSelected).toHaveAttribute("aria-pressed", "true");
  });

  it("persists state via onPersist on each placement", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Component config={tapCfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    await user.click(screen.getByRole("button", { name: /^nucleus$/i }));
    await user.click(screen.getByRole("button", { name: /nucleus zone/i }));
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"d-nucleus":"z-nucleus"/);
  });

  it("single-point scoring awards 1 only when everything is correct", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const singlePointCfg: DragAndDropConfig = {
      ...tapCfg,
      behaviour: { ...tapCfg.behaviour, singlePoint: true },
    };
    render(<Component config={singlePointCfg} onSubmit={onSubmit} />);
    // Place correctly.
    await user.click(screen.getByRole("button", { name: /^nucleus$/i }));
    await user.click(screen.getByRole("button", { name: /nucleus zone/i }));
    await user.click(screen.getByRole("button", { name: /^chloroplast$/i }));
    await user.click(screen.getByRole("button", { name: /chloroplast zone/i }));
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 1, success: true });
  });
});

describe("DragAndDrop — resume from suspend data", () => {
  it("rehydrates placement from suspendData", () => {
    const suspend = JSON.stringify({
      stage: "answering",
      placement: { "d-nucleus": "z-nucleus", "d-chloroplast": null },
      selectedChipId: null,
      attempts: 0,
    });
    render(<Component config={tapCfg} onSubmit={vi.fn()} suspendData={suspend} />);
    const zone = screen.getByRole("button", { name: /nucleus zone/i });
    expect(within(zone).queryByText("Nucleus")).not.toBeNull();
  });

  it("drops a placement that points at a deleted zone (chip returns to the tray)", () => {
    // z-gone is not in the config. The persisted placement must not
    // survive as an invisible orphan — the chip belongs back in the tray.
    const suspend = JSON.stringify({
      stage: "answering",
      placement: { "d-nucleus": "z-gone", "d-chloroplast": null },
      selectedChipId: null,
      attempts: 0,
    });
    render(<Component config={tapCfg} onSubmit={vi.fn()} suspendData={suspend} />);
    const zone = screen.getByRole("button", { name: /nucleus zone/i });
    expect(within(zone).queryByText("Nucleus")).toBeNull();
    // Chip is a selectable tray button again.
    expect(screen.getByRole("button", { name: /^nucleus$/i })).toBeInTheDocument();
  });
});

describe("DragAndDrop — background image accessibility", () => {
  it("exposes the board as a group (not an ARIA img that would hide zones)", () => {
    // tapCfg carries a background image. role="img" makes the subtree
    // presentational, stripping every zone/chip from the a11y tree.
    render(<Component config={tapCfg} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("img")).toBeNull();
    const board = screen.getByRole("group", { name: /drop board/i });
    expect(board).toBeInTheDocument();
    // The image's alt text is still exposed, via aria-describedby.
    expect(board).toHaveAccessibleDescription(/plant cell/i);
    // Zones remain queryable by name.
    expect(screen.getByRole("button", { name: /nucleus zone/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /chloroplast zone/i })).toBeInTheDocument();
  });
});

describe("DragAndDrop — distractor chips (empty correctZones)", () => {
  const distractorCfg: DragAndDropConfig = {
    ...tapCfg,
    draggables: [
      { id: "d-nucleus", label: "Nucleus", correctZones: ["z-nucleus"] },
      { id: "d-decoy", label: "Decoy", correctZones: [] },
    ],
  };

  it("does not gate Check, and scores as correct when left in the tray", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={distractorCfg} onSubmit={onSubmit} />);
    const check = screen.getByRole("button", { name: /check/i });
    expect(check).toBeDisabled();
    // Place only the real chip; the decoy stays in the tray.
    await user.click(screen.getByRole("button", { name: /^nucleus$/i }));
    await user.click(screen.getByRole("button", { name: /nucleus zone/i }));
    expect(screen.getByRole("button", { name: /^decoy$/i })).toBeInTheDocument();
    expect(check).toBeEnabled();
    await user.click(check);
    // Both count: nucleus placed right, decoy correctly left unplaced.
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 2, max: 2, success: true });
  });
});

describe("DragAndDrop — zone keyboard semantics by mode", () => {
  it("keeps zones out of the Tab order in drag mode (Space/Enter are inert there)", () => {
    // cfg has no interaction override → desktop width mounts DragLayer.
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /nucleus zone/i })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("keeps zones focusable in tap mode", () => {
    render(<Component config={tapCfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /nucleus zone/i })).toHaveAttribute(
      "tabindex",
      "0",
    );
  });
});

describe("DragAndDrop — Show solution", () => {
  it("after submit, clicking Show solution moves chips into their correct zones", async () => {
    const user = userEvent.setup();
    const solutionCfg: DragAndDropConfig = {
      ...tapCfg,
      behaviour: { ...tapCfg.behaviour, enableSolutionsButton: true },
    };
    render(<Component config={solutionCfg} onSubmit={vi.fn()} />);
    // Submit with wrong placements.
    await user.click(screen.getByRole("button", { name: /^nucleus$/i }));
    await user.click(screen.getByRole("button", { name: /chloroplast zone/i })); // wrong
    await user.click(screen.getByRole("button", { name: /^chloroplast$/i }));
    await user.click(screen.getByRole("button", { name: /nucleus zone/i })); // wrong
    await user.click(screen.getByRole("button", { name: /check/i }));
    // Show solution.
    await user.click(screen.getByRole("button", { name: /show solution/i }));
    const nz = screen.getByRole("button", { name: /nucleus zone/i });
    const cz = screen.getByRole("button", { name: /chloroplast zone/i });
    expect(within(nz).queryByText("Nucleus")).not.toBeNull();
    expect(within(cz).queryByText("Chloroplast")).not.toBeNull();
  });
});

/**
 * Drag regression test — the canary the redesign was motivated by.
 *
 * The previous DnD implementation broke entirely after the
 * `pointer-events: none` change in e2b0161 — pointerdown / pointermove
 * sequences never made it through to dnd-kit. This test boots a real
 * DndContext with PointerSensor and dispatches actual pointer events;
 * if the chip + zone wiring is intact, the chip lands in the zone.
 *
 * Notes for stability across PointerSensor versions:
 *  - PointerSensor defaults to no activation distance. We still
 *    dispatch a pointermove + pointerup so the gesture completes.
 *  - jsdom doesn't implement pointer events natively — @testing-library
 *    fireEvent.pointer{Down,Move,Up} works as long as we provide the
 *    bare event init (clientX/clientY, pointerId, pointerType).
 *  - dnd-kit measures rects from getBoundingClientRect(). In jsdom
 *    every element returns 0x0, so we monkey-patch the chip + zone
 *    DOMRect to give them sensible coordinates that don't overlap.
 */
describe("DragAndDrop — drag regression test (DndContext + PointerSensor)", () => {
  const origGBCR = Element.prototype.getBoundingClientRect;
  const origPointerEvent = (globalThis as { PointerEvent?: unknown }).PointerEvent;

  beforeEach(() => {
    // jsdom doesn't implement PointerEvent. Without it,
    // @testing-library/fireEvent falls back to a bare Event, which
    // doesn't carry pointerType / isPrimary / clientX. dnd-kit's
    // PointerSensor activator filters on `event.isPrimary` so the
    // gesture never starts. Polyfill PointerEvent with a MouseEvent
    // subclass that forwards the relevant init properties.
    class FakePointerEvent extends window.MouseEvent {
      public pointerId: number;
      public pointerType: string;
      public isPrimary: boolean;
      public width: number;
      public height: number;
      public pressure: number;
      constructor(
        type: string,
        init: PointerEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean } = {},
      ) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? "mouse";
        this.isPrimary = init.isPrimary ?? true;
        this.width = init.width ?? 1;
        this.height = init.height ?? 1;
        this.pressure = init.pressure ?? 0;
      }
    }
    (window as unknown as { PointerEvent: typeof FakePointerEvent }).PointerEvent =
      FakePointerEvent;
    // jsdom doesn't implement these — make them no-ops so dnd-kit
    // doesn't throw when calling them after pointerdown.
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = function () {};
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = function () {};
    }
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = function () {
        return false;
      };
    }

    // jsdom returns 0x0 rects; @dnd-kit's collision detection can't
    // tell what's under the cursor without real geometry. Patch the
    // tray chip + zone rects so dnd-kit sees the zone under the
    // pointerup position.
    Element.prototype.getBoundingClientRect = function () {
      const el = this as HTMLElement;
      const lbl = el.getAttribute("aria-label") ?? "";
      // Zones — distinguished by aria-label.
      if (lbl === "Nucleus zone") return rect(200, 0, 400, 200);
      if (lbl === "Chloroplast zone") return rect(700, 0, 100, 100);
      // Chips have a 80x40 starting rect. dnd-kit's collision detection
      // uses the active draggable's rect + the pointer-delta translate
      // (we apply the translate in-place via Chip.tsx now — no overlay).
      if (el.classList?.contains("kukui-dnd__chip")) {
        return rect(0, 0, 80, 40);
      }
      return rect(0, 0, 1000, 1000);
    };
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = origGBCR;
    if (origPointerEvent === undefined) {
      delete (window as unknown as { PointerEvent?: unknown }).PointerEvent;
    } else {
      (window as unknown as { PointerEvent: unknown }).PointerEvent =
        origPointerEvent;
    }
  });

  it("pointerdown + pointermove + pointerup places the chip into the zone", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const chip = screen.getByRole("button", { name: /^nucleus$/i });

    act(() => {
      // PointerSensor activator requires isPrimary === true and
      // button === 0. jsdom defaults isPrimary to false on synthetic
      // events — supply it explicitly.
      fireEvent.pointerDown(chip, {
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        clientX: 5,
        clientY: 5,
      });
    });
    act(() => {
      // Move the cursor over Nucleus zone. Active chip rect mock is
      // (0, 0, 80, 40); delta = (345, 75); collisionRect ends at
      // (345, 75, 80, 40) — well inside the zone at (200, 0, 400, 200).
      fireEvent.pointerMove(chip, {
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        clientX: 350,
        clientY: 80,
      });
    });
    act(() => {
      fireEvent.pointerUp(chip, {
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        clientX: 350,
        clientY: 80,
      });
    });

    const nz = screen.getByRole("button", { name: /nucleus zone/i });
    expect(within(nz).queryByText("Nucleus")).not.toBeNull();
  });
});

function rect(x: number, y: number, w: number, h: number): DOMRect {
  return {
    x,
    y,
    width: w,
    height: h,
    top: y,
    left: x,
    right: x + w,
    bottom: y + h,
    toJSON: () => ({}),
  } as DOMRect;
}
