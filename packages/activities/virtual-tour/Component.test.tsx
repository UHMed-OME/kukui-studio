import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { VirtualTourConfig } from "./schema.js";
import Component, { shouldSteerCamera } from "./Component.js";

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

  it("Escape closes the overlay and restores focus to the opener", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const opener = screen.getByRole("button", { name: /stop one/i });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Close button takes focus on open.
    expect(screen.getByRole("button", { name: /close overlay/i })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Focus restore is deferred a microtask past the close commit.
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("a resume-restored overlay does not autoplay audio; a fresh visit does", async () => {
    const user = userEvent.setup();
    const cfgAudio: VirtualTourConfig = {
      ...cfg,
      overlays: [
        {
          id: "stop-1",
          title: "Stop One",
          position: { x: 1, y: 0, z: 0 },
          content: [
            { type: "text", html: "<p>Welcome.</p>" },
            { type: "audio", src: "audio/welcome.mp3", autoplay: true },
          ],
        },
      ],
      completion: { mode: "manual" },
    };
    const suspend = JSON.stringify({
      stage: "exploring",
      visited: ["stop-1"],
      openOverlayId: "stop-1",
    });
    const { container } = render(
      <Component config={cfgAudio} onSubmit={vi.fn()} suspendData={suspend} />,
    );
    // Overlay restored open, but no autoplay without a user gesture.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const restored = container.querySelector("audio");
    expect(restored).not.toBeNull();
    expect(restored!.hasAttribute("autoplay")).toBe(false);

    // Close and re-open by clicking: the authored autoplay now applies.
    await user.click(screen.getByRole("button", { name: /close overlay/i }));
    await user.click(screen.getByRole("button", { name: /stop one/i }));
    const fresh = container.querySelector("audio");
    expect(fresh).not.toBeNull();
    expect(fresh!.hasAttribute("autoplay")).toBe(true);
  });

  it("failed manual Done offers Try again (enableRetry) and returns to exploring", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /stop one/i }));
    await user.click(screen.getByRole("button", { name: /^done$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 2, success: false });

    // enableRetry defaults on: a failed submit is not a dead end.
    const retry = screen.getByRole("button", { name: /try again/i });
    await user.click(retry);

    // Back to exploring with the visited set kept — finish the missing stop.
    expect(screen.getByRole("button", { name: /^done$/i })).toBeInTheDocument();
    expect(screen.getByText(/visited 1 of 2/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /stop two/i }));
    await user.click(screen.getByRole("button", { name: /^done$/i }));
    expect(onSubmit.mock.calls.at(-1)?.[0]).toMatchObject({ raw: 2, max: 2, success: true });
  });

  it("failed Done with enableRetry:false stays locked (no Try again)", async () => {
    const user = userEvent.setup();
    const cfgNoRetry: VirtualTourConfig = {
      ...cfg,
      behaviour: { enableRetry: false },
    };
    render(<Component config={cfgNoRetry} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /stop one/i }));
    await user.click(screen.getByRole("button", { name: /^done$/i }));
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
    expect(screen.getByText(/submitted with 1 of 2/i)).toBeInTheDocument();
  });
});

describe("VirtualTour — shouldSteerCamera", () => {
  it("never steals keys while typing in an input / textarea / contenteditable", () => {
    const wrap = document.createElement("div");
    wrap.tabIndex = 0;
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    document.body.append(wrap, input, textarea);
    input.focus();
    expect(shouldSteerCamera(input, wrap)).toBe(false);
    textarea.focus();
    expect(shouldSteerCamera(textarea, wrap)).toBe(false);
    wrap.remove();
    input.remove();
    textarea.remove();
  });

  it("does not steer while focus sits outside the canvas wrapper", () => {
    const wrap = document.createElement("div");
    wrap.tabIndex = 0;
    const outside = document.createElement("button");
    document.body.append(wrap, outside);
    outside.focus();
    expect(shouldSteerCamera(outside, wrap)).toBe(false);
    wrap.remove();
    outside.remove();
  });

  it("steers while the canvas wrapper has focus", () => {
    const wrap = document.createElement("div");
    wrap.tabIndex = 0;
    document.body.append(wrap);
    wrap.focus();
    expect(shouldSteerCamera(wrap, wrap)).toBe(true);
    wrap.remove();
  });
});
