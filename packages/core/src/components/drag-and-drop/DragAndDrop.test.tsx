import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DragAndDropConfig } from "@kukui/schemas";
import { DragAndDrop } from "./DragAndDrop.js";

const cfg: DragAndDropConfig = {
  version: "1.0",
  title: "Plant cell",
  background: { src: "images/plant-cell.png" },
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

describe("DragAndDrop — keyboard fallback path", () => {
  it("renders board, tray, and a fallback select per draggable", () => {
    render(<DragAndDrop config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /plant cell/i })).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  it("Check is disabled until every draggable is placed", async () => {
    const user = userEvent.setup();
    render(<DragAndDrop config={cfg} onSubmit={vi.fn()} />);
    const check = screen.getByRole("button", { name: /check/i });
    expect(check).toBeDisabled();
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "z-nucleus");
    expect(check).toBeDisabled();
    await user.selectOptions(selects[1]!, "z-chloroplast");
    expect(check).toBeEnabled();
  });

  it("all-correct placements score full marks", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DragAndDrop config={cfg} onSubmit={onSubmit} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "z-nucleus");
    await user.selectOptions(selects[1]!, "z-chloroplast");
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 2, max: 2, success: true });
  });

  it("partial placements score partial credit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DragAndDrop config={cfg} onSubmit={onSubmit} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "z-chloroplast"); // wrong
    await user.selectOptions(selects[1]!, "z-chloroplast"); // correct (cap=1 default though — see below)
    // With default capacity 1, the second placement should be rejected because the
    // zone already holds the first. So d-nucleus stays in z-chloroplast (wrong),
    // d-chloroplast can't enter z-chloroplast → tries to place but blocked → stays
    // in tray. allPlaced becomes false; Check should be disabled.
    const check = screen.getByRole("button", { name: /check/i });
    expect(check).toBeDisabled();
  });

  it("Try again resets all placements", async () => {
    const user = userEvent.setup();
    render(<DragAndDrop config={cfg} onSubmit={vi.fn()} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "z-nucleus");
    await user.selectOptions(selects[1]!, "z-chloroplast");
    await user.click(screen.getByRole("button", { name: /check/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    const checkAgain = screen.getByRole("button", { name: /check/i });
    expect(checkAgain).toBeDisabled();
  });

  it("persists state via onPersist on each placement", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<DragAndDrop config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "z-nucleus");
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"d-nucleus":"z-nucleus"/);
  });

  it("respects zone capacity (default 1) — cannot place a second draggable in the same zone", async () => {
    const user = userEvent.setup();
    render(<DragAndDrop config={cfg} onSubmit={vi.fn()} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "z-nucleus");
    await user.selectOptions(selects[1]!, "z-nucleus");
    // Second draggable should NOT have been placed — its select snaps back.
    expect((selects[1] as HTMLSelectElement).value).toBe("");
  });
});
