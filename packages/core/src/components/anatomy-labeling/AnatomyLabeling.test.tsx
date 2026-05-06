import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnatomyLabelingConfig } from "@kukui/schemas";
import { AnatomyLabeling } from "./AnatomyLabeling.js";

const cfg: AnatomyLabelingConfig = {
  version: "1.0",
  title: "Label the parts of a neuron",
  prompt: "<p>Drag each name onto the matching numbered target.</p>",
  image: {
    src: "https://placehold.co/1024x640?text=Neuron",
    alt: "Diagram of a neuron",
  },
  labels: [
    { id: "l-dendrite", text: "Dendrite", correctTargetId: "t-1" },
    { id: "l-soma", text: "Soma", correctTargetId: "t-2" },
    { id: "l-axon", text: "Axon", correctTargetId: "t-3" },
  ],
  targets: [
    { id: "t-1", position: { x: 0.2, y: 0.4 } },
    { id: "t-2", position: { x: 0.4, y: 0.5 } },
    { id: "t-3", position: { x: 0.7, y: 0.5 } },
  ],
  behaviour: { enableRetry: true },
};

describe("AnatomyLabeling — keyboard fallback path", () => {
  it("renders title, prompt, image, and a fallback select per label", () => {
    render(<AnatomyLabeling config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /label the parts of a neuron/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/drag each name/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /diagram of a neuron/i })).toBeInTheDocument();
    // One <select> per label.
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    // Targets render numbered 1, 2, 3 inside the diagram.
    expect(screen.getByLabelText(/target 1: empty/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target 2: empty/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target 3: empty/i)).toBeInTheDocument();
  });

  it("Check is disabled until every label is placed via the keyboard select", async () => {
    const user = userEvent.setup();
    render(<AnatomyLabeling config={cfg} onSubmit={vi.fn()} />);
    const check = screen.getByRole("button", { name: /check/i });
    expect(check).toBeDisabled();
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "t-1");
    await user.selectOptions(selects[1]!, "t-2");
    expect(check).toBeDisabled();
    await user.selectOptions(selects[2]!, "t-3");
    expect(check).toBeEnabled();
  });

  it("all-correct placements score full marks (1 point per label)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AnatomyLabeling config={cfg} onSubmit={onSubmit} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "t-1");
    await user.selectOptions(selects[1]!, "t-2");
    await user.selectOptions(selects[2]!, "t-3");
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 3,
      max: 3,
      success: true,
    });
  });

  it("partial correctness yields partial credit by default", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AnatomyLabeling config={cfg} onSubmit={onSubmit} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "t-1"); // correct
    await user.selectOptions(selects[1]!, "t-3"); // wrong
    await user.selectOptions(selects[2]!, "t-2"); // wrong
    // Note: placing soma on t-3 first, then axon on t-2 leaves no conflict on a
    // shared target — each select picks a distinct target.
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 1,
      max: 3,
      success: false,
    });
  });

  it("singlePoint scoring is all-or-nothing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const sp: AnatomyLabelingConfig = {
      ...cfg,
      behaviour: { ...cfg.behaviour, singlePoint: true },
    };
    render(<AnatomyLabeling config={sp} onSubmit={onSubmit} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "t-1");
    await user.selectOptions(selects[1]!, "t-3"); // wrong
    await user.selectOptions(selects[2]!, "t-2"); // wrong
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 0,
      max: 1,
      success: false,
    });
  });

  it("Try again resets all placements", async () => {
    const user = userEvent.setup();
    render(<AnatomyLabeling config={cfg} onSubmit={vi.fn()} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "t-1");
    await user.selectOptions(selects[1]!, "t-2");
    await user.selectOptions(selects[2]!, "t-3");
    await user.click(screen.getByRole("button", { name: /check/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    const checkAgain = screen.getByRole("button", { name: /check/i });
    expect(checkAgain).toBeDisabled();
    // Selects all reset to empty value (Tray).
    for (const s of screen.getAllByRole("combobox")) {
      expect((s as HTMLSelectElement).value).toBe("");
    }
  });

  it("persists state via onPersist on each placement change", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<AnatomyLabeling config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "t-1");
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"l-dendrite":"t-1"/);
  });

  it("placing a second label on an occupied target bumps the first label back to the tray", async () => {
    const user = userEvent.setup();
    render(<AnatomyLabeling config={cfg} onSubmit={vi.fn()} />);
    const selects = screen.getAllByRole("combobox");
    // Both labels claim target t-1; second placement should win, first reverts.
    await user.selectOptions(selects[0]!, "t-1");
    await user.selectOptions(selects[1]!, "t-1");
    expect((selects[0] as HTMLSelectElement).value).toBe("");
    expect((selects[1] as HTMLSelectElement).value).toBe("t-1");
  });

  it("after submit, shows a correction note beside wrongly-placed labels", async () => {
    const user = userEvent.setup();
    render(<AnatomyLabeling config={cfg} onSubmit={vi.fn()} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "t-2"); // dendrite wrong; correct is t-1 (target 1)
    await user.selectOptions(selects[1]!, "t-3"); // soma wrong; correct is t-2 (target 2)
    await user.selectOptions(selects[2]!, "t-1"); // axon wrong; correct is t-3 (target 3)
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(screen.getByText(/correct: target 1/i)).toBeInTheDocument();
    expect(screen.getByText(/correct: target 2/i)).toBeInTheDocument();
    expect(screen.getByText(/correct: target 3/i)).toBeInTheDocument();
  });
});
