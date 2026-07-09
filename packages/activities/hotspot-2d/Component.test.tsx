import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Hotspot2DConfig } from "./schema.js";
import Component from "./Component.js";

const cfg: Hotspot2DConfig = {
  version: "1.0",
  title: "Identify the cell organelle",
  prompt: "<p>Click the <em>nucleus</em>.</p>",
  image: {
    src: "https://placehold.co/1024x640?text=Cell",
    alt: "Labeled cell diagram",
  },
  hotspots: [
    {
      id: "nucleus",
      label: "Nucleus",
      rect: { x: 0.4, y: 0.35, w: 0.2, h: 0.2 },
      correct: true,
      feedback: "The nucleus holds the DNA.",
    },
    {
      id: "mitochondrion",
      label: "Mitochondrion",
      rect: { x: 0.7, y: 0.5, w: 0.15, h: 0.15 },
      correct: false,
      feedback: "That is a mitochondrion.",
    },
  ],
  behaviour: { enableRetry: true, showHotspotMarkers: true },
};

// Each hotspot renders twice (image overlay marker + keyboard fallback
// list), so name queries return two buttons. Both drive the same select().
const firstButton = (name: RegExp) => screen.getAllByRole("button", { name })[0]!;

describe("Hotspot2D — selection and submit", () => {
  it("renders title, prompt, image, markers, and fallback list", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /identify the cell organelle/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/click the/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /labeled cell diagram/i })).toBeInTheDocument();
    // Marker + fallback entry per hotspot.
    expect(screen.getAllByRole("button", { name: /nucleus/i }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
  });

  it("clicking a hotspot selects without submitting; Check becomes enabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(firstButton(/^nucleus/i));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^check$/i })).toBeEnabled();
  });

  it("Check on a correct selection scores 1/1 and shows its feedback", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(firstButton(/^nucleus/i));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 1, success: true });
    expect(screen.getByText(/the nucleus holds the dna/i)).toBeInTheDocument();
  });

  it("Check on a wrong selection scores 0/1 and reveals the correct region", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(firstButton(/^mitochondrion/i));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 0, max: 1, success: false });
    // The correct hotspot's buttons pick up the reveal styling.
    const revealed = screen
      .getAllByRole("button", { name: /^nucleus/i })
      .filter((b) => b.className.includes("is-reveal"));
    expect(revealed.length).toBeGreaterThanOrEqual(1);
  });

  it("honors ui.checkAnswerButton", () => {
    const custom: Hotspot2DConfig = { ...cfg, ui: { checkAnswerButton: "Lock it in" } };
    render(<Component config={custom} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /lock it in/i })).toBeInTheDocument();
  });
});

describe("Hotspot2D — retry via the scoring block", () => {
  it("renders Try Again when scoring.enableRetry is true and behaviour has no retry flag", async () => {
    // Regression: Studio's migrator strips behaviour.enableRetry into
    // scoring.enableRetry; reading behaviour directly hid the button.
    const user = userEvent.setup();
    const migrated: Hotspot2DConfig = {
      ...cfg,
      behaviour: { showHotspotMarkers: true },
      scoring: { mode: "points", enableRetry: true },
    };
    render(<Component config={migrated} onSubmit={vi.fn()} />);
    await user.click(firstButton(/^mitochondrion/i));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    const tryAgain = screen.getByRole("button", { name: /try again/i });
    await user.click(tryAgain);
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
  });

  it("hides Try Again when scoring.enableRetry is false", async () => {
    const user = userEvent.setup();
    const noRetry: Hotspot2DConfig = {
      ...cfg,
      behaviour: { showHotspotMarkers: true },
      scoring: { mode: "points", enableRetry: false },
    };
    render(<Component config={noRetry} onSubmit={vi.fn()} />);
    await user.click(firstButton(/^nucleus/i));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });
});

describe("Hotspot2D — suspend / resume", () => {
  it("restores a submitted attempt with a valid hotspot id", () => {
    const suspend = JSON.stringify({
      stage: "submitted",
      selectedHotspotId: "nucleus",
      attempts: 1,
    });
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={suspend} />);
    expect(screen.queryByRole("button", { name: /^check$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/the nucleus holds the dna/i)).toBeInTheDocument();
  });

  it("drops a persisted selection whose hotspot id no longer exists", () => {
    const suspend = JSON.stringify({
      stage: "answering",
      selectedHotspotId: "deleted-hotspot",
      attempts: 0,
    });
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={suspend} />);
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
  });

  it("ignores malformed suspendData", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData="{oops" />);
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
  });

  it("persists selection via onPersist", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    await user.click(firstButton(/^nucleus/i));
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"selectedHotspotId":"nucleus"/);
  });
});
