import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CategorizationConfig } from "@kukui/schemas";
import { Categorization } from "./Categorization.js";

const cfg: CategorizationConfig = {
  version: "1.0",
  title: "Sort the organisms",
  prompt: "<p>Drag each organism into its kingdom.</p>",
  items: [
    { id: "i-oak", text: "Oak tree", correctCategory: "c-plantae" },
    { id: "i-shark", text: "Shark", correctCategory: "c-animalia" },
    { id: "i-mushroom", text: "Mushroom", correctCategory: "c-fungi" },
  ],
  categories: [
    { id: "c-plantae", label: "Plantae" },
    { id: "c-animalia", label: "Animalia" },
    { id: "c-fungi", label: "Fungi" },
  ],
  behaviour: { enableRetry: true },
};

describe("Categorization — keyboard fallback path", () => {
  it("renders title, prompt, bins, and a fallback select per item", () => {
    render(<Categorization config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /sort the organisms/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/drag each organism/i)).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    // Each category bin labeled.
    expect(screen.getByLabelText("Plantae")).toBeInTheDocument();
    expect(screen.getByLabelText("Animalia")).toBeInTheDocument();
    expect(screen.getByLabelText("Fungi")).toBeInTheDocument();
  });

  it("Check is disabled until every item is binned", async () => {
    const user = userEvent.setup();
    render(<Categorization config={cfg} onSubmit={vi.fn()} />);
    const check = screen.getByRole("button", { name: /check/i });
    expect(check).toBeDisabled();
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "c-plantae");
    await user.selectOptions(selects[1]!, "c-animalia");
    expect(check).toBeDisabled();
    await user.selectOptions(selects[2]!, "c-fungi");
    expect(check).toBeEnabled();
  });

  it("all-correct placements score full marks (1 point per item)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Categorization config={cfg} onSubmit={onSubmit} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "c-plantae");
    await user.selectOptions(selects[1]!, "c-animalia");
    await user.selectOptions(selects[2]!, "c-fungi");
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 3, max: 3, success: true });
  });

  it("partial correctness yields partial credit by default", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Categorization config={cfg} onSubmit={onSubmit} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "c-plantae"); // correct
    await user.selectOptions(selects[1]!, "c-fungi"); // wrong
    await user.selectOptions(selects[2]!, "c-fungi"); // correct
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 2, max: 3, success: false });
  });

  it("singlePoint scoring is all-or-nothing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const sp: CategorizationConfig = {
      ...cfg,
      behaviour: { ...cfg.behaviour, singlePoint: true },
    };
    render(<Categorization config={sp} onSubmit={onSubmit} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "c-plantae");
    await user.selectOptions(selects[1]!, "c-fungi"); // wrong
    await user.selectOptions(selects[2]!, "c-fungi");
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 0, max: 1, success: false });
  });

  it("Try again resets all placements", async () => {
    const user = userEvent.setup();
    render(<Categorization config={cfg} onSubmit={vi.fn()} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "c-plantae");
    await user.selectOptions(selects[1]!, "c-animalia");
    await user.selectOptions(selects[2]!, "c-fungi");
    await user.click(screen.getByRole("button", { name: /check/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    const checkAgain = screen.getByRole("button", { name: /check/i });
    expect(checkAgain).toBeDisabled();
  });

  it("persists state via onPersist on each placement change", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Categorization config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "c-plantae");
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"i-oak":"c-plantae"/);
  });

  it("after submit, shows correct-category indicator beside wrong items", async () => {
    const user = userEvent.setup();
    render(<Categorization config={cfg} onSubmit={vi.fn()} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "c-animalia"); // oak in wrong bin
    await user.selectOptions(selects[1]!, "c-animalia");
    await user.selectOptions(selects[2]!, "c-fungi");
    await user.click(screen.getByRole("button", { name: /check/i }));
    // Wrong oak should show the correction text.
    expect(screen.getByText(/Correct: Plantae/)).toBeInTheDocument();
  });
});
