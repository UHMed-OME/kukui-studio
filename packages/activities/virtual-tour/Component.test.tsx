import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { VirtualTourConfig } from "./schema.js";
import Component from "./Component.js";

const cfg: VirtualTourConfig = {
  version: "1.0",
  title: "Test tour",
  scene: { src: "scenes/test.glb" },
  overlays: [
    {
      id: "stop-1",
      title: "Stop One",
      position: { x: 1, y: 0, z: 0 },
      content: [{ type: "text", html: "<p>Welcome to stop one.</p>" }],
    },
    {
      id: "stop-2",
      title: "Stop Two",
      position: { x: 2, y: 0, z: 0 },
      content: [{ type: "text", html: "<p>This is stop two.</p>" }],
    },
  ],
  completion: { mode: "manual" },
};

const cfgVisitAll: VirtualTourConfig = {
  ...cfg,
  completion: { mode: "visitAll", requiredOverlayIds: ["stop-1", "stop-2"] },
};

describe("VirtualTour — fallback list", () => {
  it("renders title and one button per overlay", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /test tour/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop one/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop two/i })).toBeInTheDocument();
  });

  it("clicking a fallback button opens the overlay panel and marks visited", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /stop one/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/welcome to stop one/i)).toBeInTheDocument();
    expect(screen.getByText(/visited 1 of 2/i)).toBeInTheDocument();
  });

  it("manual completion: Done button calls onSubmit with visited count", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /stop one/i }));
    await user.click(screen.getByRole("button", { name: /^done$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 2, success: false });
  });

  it("visitAll auto-submits when every required overlay is visited", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfgVisitAll} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /stop one/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /stop two/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 2, max: 2, success: true });
  });

  it("persists state via onPersist on each visit", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    await user.click(screen.getByRole("button", { name: /stop one/i }));
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"visited":\["stop-1"\]/);
  });
});
