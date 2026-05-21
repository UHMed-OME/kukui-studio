import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LabPanelConfig } from "./schema.js";
import Component from "./Component.js";

const cfg: LabPanelConfig = {
  version: "1.0",
  title: "ABG Pattern",
  prompt: "<p>Read the <strong>arterial blood gas</strong> and mark the abnormal values.</p>",
  panel: {
    name: "Arterial Blood Gas",
    values: [
      {
        id: "ph",
        analyte: "pH",
        result: "7.18",
        reference: "7.35–7.45",
        flag: "low",
        isAbnormal: true,
      },
      {
        id: "paco2",
        analyte: "PaCO2",
        result: "22",
        units: "mmHg",
        reference: "35–45",
        flag: "low",
        isAbnormal: true,
      },
      {
        id: "hco3",
        analyte: "HCO3",
        result: "8",
        units: "mEq/L",
        reference: "22–26",
        flag: "low",
        isAbnormal: true,
      },
      {
        id: "na",
        analyte: "Na",
        result: "138",
        units: "mEq/L",
        reference: "135–145",
        flag: "normal",
        isAbnormal: false,
      },
    ],
  },
  interpretation: {
    question: "<p>Best interpretation?</p>",
    choices: [
      {
        id: "c0",
        text: "Respiratory alkalosis",
        correct: false,
        feedback: "Low pH rules out alkalosis.",
      },
      {
        id: "c1",
        text: "Metabolic acidosis with respiratory compensation",
        correct: true,
        feedback: "Yes — low pH, low HCO3, compensatory low PaCO2.",
      },
      {
        id: "c2",
        text: "Mixed acidosis",
        correct: false,
        feedback: "PaCO2 is low, not high.",
      },
    ],
  },
  behaviour: { enableRetry: true },
  ui: { checkAnswerButton: "Check", tryAgainButton: "Try again" },
};

describe("LabPanel", () => {
  it("renders title, prompt, panel table, and the interpretation question", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /abg pattern/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/read the/i, { exact: false }),
    ).toBeInTheDocument();
    // Table is screen-reader navigable.
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /analyte/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /result/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /units/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /reference/i })).toBeInTheDocument();
    // Each row has its analyte as a row header so SR users navigate cells.
    const rowHeaders = screen.getAllByRole("rowheader");
    expect(rowHeaders).toHaveLength(cfg.panel.values.length);
    // Interpretation question text is present.
    expect(
      screen.getByText(/best interpretation/i),
    ).toBeInTheDocument();
    // Three radio choices are exposed.
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(cfg.interpretation.choices.length);
  });

  it("clicking a row toggles its aria-pressed flag", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const ph = screen.getByRole("button", { name: /^toggle ph,/i });
    expect(ph).toHaveAttribute("aria-pressed", "false");
    await user.click(ph);
    expect(
      screen.getByRole("button", { name: /^toggle ph,.*marked abnormal$/i }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(
      screen.getByRole("button", { name: /^toggle ph,.*marked abnormal$/i }),
    );
    expect(
      screen.getByRole("button", { name: /^toggle ph,.*not marked$/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("Check is disabled until an interpretation is picked", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const check = screen.getByRole("button", { name: /^check$/i });
    expect(check).toBeDisabled();
    // Toggling rows alone does not enable Check — interpretation is required.
    await user.click(screen.getByRole("button", { name: /^toggle ph,/i }));
    expect(check).toBeDisabled();
    await user.click(
      screen.getByRole("radio", {
        name: /metabolic acidosis with respiratory compensation/i,
      }),
    );
    expect(check).toBeEnabled();
  });

  it("scores 1 point per correctly classified row + 1 for the right interpretation", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    // Mark all three abnormal values; leave Na alone.
    await user.click(screen.getByRole("button", { name: /^toggle ph,/i }));
    await user.click(screen.getByRole("button", { name: /^toggle paco2,/i }));
    await user.click(screen.getByRole("button", { name: /^toggle hco3,/i }));
    // Pick the correct interpretation.
    await user.click(
      screen.getByRole("radio", {
        name: /metabolic acidosis with respiratory compensation/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    // 3 correct row picks + 1 correct interpretation = 4 / 4
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 4,
      max: 4,
      success: true,
    });
    // Per-choice feedback shows up for the picked correct interpretation.
    expect(
      screen.getByText(/yes — low ph, low hco3/i),
    ).toBeInTheDocument();
  });

  it("partial credit: one wrong row pick + correct interpretation nets less than full", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    // 1 right (pH) + 1 wrong (Na) → row score earned = 0, max = 3
    await user.click(screen.getByRole("button", { name: /^toggle ph,/i }));
    await user.click(screen.getByRole("button", { name: /^toggle na,/i }));
    await user.click(
      screen.getByRole("radio", {
        name: /metabolic acidosis with respiratory compensation/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    // earned = +1 (ph) -1 (na) = 0 clamped, +1 interpretation = 1; max = 3 + 1 = 4
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 1,
      max: 4,
      success: false,
    });
  });

  it("Try again returns to the answering stage and clears selections", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^toggle ph,/i }));
    await user.click(
      screen.getByRole("radio", {
        name: /metabolic acidosis with respiratory compensation/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /^toggle ph,.*not marked$/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("radio", {
        name: /metabolic acidosis.*not selected/i,
      }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("persists state via onPersist when the learner interacts", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(
      <Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />,
    );
    await user.click(screen.getByRole("button", { name: /^toggle ph,/i }));
    expect(onPersist).toHaveBeenCalled();
    const lastCall = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(lastCall).toMatch(/"selectedRowIds":\["ph"\]/);
    await user.click(
      screen.getByRole("radio", {
        name: /metabolic acidosis with respiratory compensation/i,
      }),
    );
    const after = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(after).toMatch(/"selectedChoiceId":"c1"/);
  });

  it("singlePoint scoring is all-or-nothing across rows + interpretation", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const sp: LabPanelConfig = {
      ...cfg,
      behaviour: { ...cfg.behaviour, singlePoint: true },
    };
    render(<Component config={sp} onSubmit={onSubmit} />);
    // Only mark pH; miss the other two abnormals.
    await user.click(screen.getByRole("button", { name: /^toggle ph,/i }));
    await user.click(
      screen.getByRole("radio", {
        name: /metabolic acidosis with respiratory compensation/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 0,
      max: 1,
      success: false,
    });
  });

  it("after submit, incorrectly classified rows pick up the is-incorrect class", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    // Mark Na (normal value) as abnormal — this should be flagged as incorrect after submit.
    await user.click(screen.getByRole("button", { name: /^toggle na,/i }));
    await user.click(
      screen.getByRole("radio", {
        name: /metabolic acidosis with respiratory compensation/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    const naBtn = screen.getByRole("button", {
      name: /^toggle na,.*incorrect/i,
    });
    // Walk up to the row to confirm class.
    const row = naBtn.closest("tr");
    expect(row).not.toBeNull();
    expect(row?.className).toMatch(/is-incorrect/);
  });
});
