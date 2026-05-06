import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Hotspot3DConfig } from "@kukui/schemas";
import { Hotspot3D } from "./Hotspot3D.js";

// JSDOM has no WebGL — these tests exercise the keyboard fallback list, which
// is the WCAG-required equivalent path. The 3D Canvas is rendered as a "scene
// unavailable" placeholder.
const cfg: Hotspot3DConfig = {
  version: "1.0",
  title: "Identify the part",
  prompt: "<p>Click the labeled part.</p>",
  model: { src: "models/test.glb" },
  hotspots: [
    {
      id: "iako",
      label: "Iako",
      position: { x: 0.3, y: 0.8, z: 0 },
      radius: 0.2,
      correct: true,
      feedback: "The cross-beam.",
    },
    {
      id: "ama",
      label: "Ama",
      position: { x: 1.2, y: 0, z: 0 },
      radius: 0.25,
      correct: false,
    },
  ],
  behaviour: { enableRetry: true },
};

describe("Hotspot3D — fallback list", () => {
  it("renders title, prompt, and a button per hotspot", () => {
    render(<Hotspot3D config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /identify the part/i })).toBeInTheDocument();
    expect(screen.getByText(/click the labeled part/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^iako$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ama$/i })).toBeInTheDocument();
  });

  it("selecting the correct hotspot scores 1/1 success and shows feedback", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Hotspot3D config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^iako$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 1, success: true });
    expect(screen.getByText(/the cross-beam/i)).toBeInTheDocument();
  });

  it("selecting wrong scores 0/1 and reveals the correct answer", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Hotspot3D config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^ama$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 0, max: 1, success: false });
    expect(screen.getByText(/correct answer was/i)).toBeInTheDocument();
  });

  it("Try again resets state when enableRetry=true", async () => {
    const user = userEvent.setup();
    render(<Hotspot3D config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^ama$/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    // Buttons re-enabled (fieldset no longer disabled)
    expect(screen.getByRole("button", { name: /^iako$/i })).toBeEnabled();
  });

  it("persists state via onPersist on each pick", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Hotspot3D config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    await user.click(screen.getByRole("button", { name: /^iako$/i }));
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"selectedHotspotId":"iako"/);
  });
});
