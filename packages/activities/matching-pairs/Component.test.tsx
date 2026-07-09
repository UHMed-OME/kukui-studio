import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MatchingPairsConfig } from "./schema.js";
import Component from "./Component.js";

const cfg: MatchingPairsConfig = {
  version: "1.0",
  title: "Match drugs to their classes",
  prompt: "<p>Pair each drug with its pharmacologic class.</p>",
  pairs: [
    { id: "p1", left: { text: "Atenolol" }, right: { text: "Beta blocker" } },
    { id: "p2", left: { text: "Lisinopril" }, right: { text: "ACE inhibitor" } },
    { id: "p3", left: { text: "Metformin" }, right: { text: "Biguanide" } },
  ],
  behaviour: { enableRetry: true, randomizeRight: false },
};

describe("MatchingPairs", () => {
  // Make shuffle deterministic across tests anyway, in case randomizeRight
  // gets flipped on a fixture.
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders title, prompt, both columns, and a fallback select per pair", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /match drugs to their classes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/pair each drug with its pharmacologic class/i),
    ).toBeInTheDocument();
    // Three combobox selects in the fallback list (one per left item).
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    // Each left and right item is its own button.
    expect(screen.getByRole("button", { name: /atenolol/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /beta blocker/i })).toBeInTheDocument();
  });

  it("Check is disabled until every left item is paired", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const check = screen.getByRole("button", { name: /^check$/i });
    expect(check).toBeDisabled();
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "p1");
    expect(check).toBeDisabled();
    await user.selectOptions(selects[1]!, "p2");
    expect(check).toBeDisabled();
    await user.selectOptions(selects[2]!, "p3");
    expect(check).toBeEnabled();
  });

  it("click-to-pair: select left, then click right, records the connection", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /atenolol/i }));
    await user.click(screen.getByRole("button", { name: /beta blocker/i }));
    await user.click(screen.getByRole("button", { name: /lisinopril/i }));
    await user.click(screen.getByRole("button", { name: /ace inhibitor/i }));
    await user.click(screen.getByRole("button", { name: /metformin/i }));
    await user.click(screen.getByRole("button", { name: /biguanide/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 3, max: 3, success: true });
  });

  it("clicking a right that is already paired swaps the connection", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    // p1.left -> p1.right
    await user.click(screen.getByRole("button", { name: /atenolol/i }));
    await user.click(screen.getByRole("button", { name: /beta blocker/i }));
    // Now p2.left grabs p1.right — should detach p1.left.
    await user.click(screen.getByRole("button", { name: /lisinopril/i }));
    await user.click(screen.getByRole("button", { name: /beta blocker/i }));
    // The Atenolol left-row is once again unpaired — its select should be empty.
    const atenololSelect = screen.getByLabelText("Atenolol") as HTMLSelectElement;
    expect(atenololSelect.value).toBe("");
    const lisinoprilSelect = screen.getByLabelText("Lisinopril") as HTMLSelectElement;
    expect(lisinoprilSelect.value).toBe("p1");
  });

  it("reveals the correct partner for incorrect pairings on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    const selects = screen.getAllByRole("combobox");
    // Two wrong pairings:
    await user.selectOptions(selects[0]!, "p2"); // Atenolol -> ACE inhibitor (wrong)
    await user.selectOptions(selects[1]!, "p1"); // Lisinopril -> Beta blocker (wrong)
    await user.selectOptions(selects[2]!, "p3"); // Metformin -> Biguanide (correct)
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 3, success: false });
    // The reveal text appears for each wrong pair.
    expect(screen.getByText(/Beta blocker/, { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/ACE inhibitor/, { selector: "strong" })).toBeInTheDocument();
  });

  it("Try again resets connections", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "p1");
    await user.selectOptions(selects[1]!, "p2");
    await user.selectOptions(selects[2]!, "p3");
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
    const fresh = screen.getAllByRole("combobox") as HTMLSelectElement[];
    for (const s of fresh) expect(s.value).toBe("");
  });

  it("calls onPersist on each connection change", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    const initialCalls = onPersist.mock.calls.length;
    await user.selectOptions(screen.getAllByRole("combobox")[0]!, "p1");
    expect(onPersist.mock.calls.length).toBeGreaterThan(initialCalls);
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"p1":"p1"/);
  });

  it("singlePoint scoring is all-or-nothing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const single: MatchingPairsConfig = {
      ...cfg,
      behaviour: { ...cfg.behaviour, singlePoint: true },
    };
    render(<Component config={single} onSubmit={onSubmit} />);
    const selects = screen.getAllByRole("combobox");
    // Two right, one wrong → singlePoint => 0 / 1.
    await user.selectOptions(selects[0]!, "p1");
    await user.selectOptions(selects[1]!, "p2");
    await user.selectOptions(selects[2]!, "p1"); // wrong + clobbers Atenolol's pair
    // After clobber, Atenolol is unpaired again. Re-pair it to satisfy allConnected.
    await user.selectOptions(selects[0]!, "p3"); // Atenolol -> Biguanide (wrong)
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 0, max: 1, success: false });
  });

  it("right column items each render in their own list region", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const rightCol = screen.getByRole("list", { name: /right column items/i });
    expect(within(rightCol).getByRole("button", { name: /beta blocker/i })).toBeInTheDocument();
    expect(within(rightCol).getByRole("button", { name: /ace inhibitor/i })).toBeInTheDocument();
    expect(within(rightCol).getByRole("button", { name: /biguanide/i })).toBeInTheDocument();
  });

  it("restores connections and rightOrder from suspendData", () => {
    const suspend = JSON.stringify({
      stage: "answering",
      connections: { p1: "p2", p2: null, p3: null },
      rightOrder: ["p3", "p1", "p2"],
      attempts: 0,
    });
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={suspend} />);
    const selects = screen.getAllByRole("combobox");
    expect(selects[0]).toHaveValue("p2");
    expect(selects[1]).toHaveValue("");
    // Right column renders in the persisted order.
    const rightCol = screen.getByRole("list", { name: /right column items/i });
    const rightButtons = within(rightCol).getAllByRole("button");
    expect(rightButtons[0]).toHaveAccessibleName(/biguanide/i);
    expect(rightButtons[1]).toHaveAccessibleName(/beta blocker/i);
    expect(rightButtons[2]).toHaveAccessibleName(/ace inhibitor/i);
  });

  it("rejects a persisted rightOrder with duplicate ids (rebuilds from config)", () => {
    const suspend = JSON.stringify({
      stage: "answering",
      connections: { p1: null, p2: null, p3: null },
      // Same length as pairs, but "p1" twice and no "p3": not set-equal.
      rightOrder: ["p1", "p1", "p2"],
      attempts: 0,
    });
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={suspend} />);
    const rightCol = screen.getByRole("list", { name: /right column items/i });
    const rightButtons = within(rightCol).getAllByRole("button");
    // Rebuilt config order: every pair rendered exactly once.
    expect(rightButtons).toHaveLength(3);
    expect(rightButtons[0]).toHaveAccessibleName(/beta blocker/i);
    expect(rightButtons[1]).toHaveAccessibleName(/ace inhibitor/i);
    expect(rightButtons[2]).toHaveAccessibleName(/biguanide/i);
  });

  it("honors the headingLevel prop", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} headingLevel={2} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /match drugs to their classes/i }),
    ).toBeInTheDocument();
  });

  it("shows a raw/max score line and the author credit after submit", async () => {
    const user = userEvent.setup();
    render(
      <Component config={{ ...cfg, author: "Dr. Aytac" }} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText(/By Dr\. Aytac/)).toBeInTheDocument();
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0]!, "p1");
    await user.selectOptions(selects[1]!, "p2");
    await user.selectOptions(selects[2]!, "p3");
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(screen.getByText(/3 \/ 3/)).toBeInTheDocument();
  });
});
