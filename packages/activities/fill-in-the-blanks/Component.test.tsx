import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FillInTheBlanksConfig } from "@kukui/schemas";
import Component from "./Component.js";

const cfg: FillInTheBlanksConfig = {
  version: "1.0",
  title: "Photosynthesis",
  text: "Plants take in *carbon dioxide|CO2* and release *oxygen|O2*.",
  behaviour: { enableRetry: true, showSolutionsButton: true, acceptSpellingErrors: true },
};

const cfgSinglePoint: FillInTheBlanksConfig = {
  version: "1.0",
  title: "Capitals",
  text: "The capital of Hawaii is *Honolulu*.",
  behaviour: { singlePoint: true },
};

describe("FillInTheBlanks", () => {
  it("renders title and one input per blank", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /photosynthesis/i })).toBeInTheDocument();
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);
  });

  it("disables Check until every blank has a value, then enables", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const check = screen.getByRole("button", { name: /check/i });
    expect(check).toBeDisabled();
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0]!, "carbon dioxide");
    expect(check).toBeDisabled();
    await user.type(inputs[1]!, "oxygen");
    expect(check).toBeEnabled();
  });

  it("partial credit: one correct, one wrong → raw=1 max=2 success=false", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0]!, "carbon dioxide");
    await user.type(inputs[1]!, "wrong");
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 2, success: false });
  });

  it("all correct → success=true", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0]!, "co2");
    await user.type(inputs[1]!, "o2");
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 2, max: 2, success: true });
  });

  it("singlePoint: all-or-nothing scoring (1/1 only when all blanks correct)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfgSinglePoint} onSubmit={onSubmit} />);
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0]!, "Honolulu");
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 1, success: true });
  });

  it("acceptSpellingErrors → Levenshtein-distance-1 typo still scores correct", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    const inputs = screen.getAllByRole("textbox");
    // "co3" is distance 1 from "co2" — should be accepted
    await user.type(inputs[0]!, "co3");
    await user.type(inputs[1]!, "o2");
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 2, max: 2, success: true });
  });

  it("Try again returns to the answering stage when enableRetry=true", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0]!, "wrong");
    await user.type(inputs[1]!, "wrong");
    await user.click(screen.getByRole("button", { name: /check/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    const checkAgain = screen.getByRole("button", { name: /check/i });
    expect(checkAgain).toBeDisabled();
  });

  it("Try again after Show solution does not leak revealed answers into the next attempt", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0]!, "wrong");
    await user.type(inputs[1]!, "wrong");
    await user.click(screen.getByRole("button", { name: /check/i }));
    await user.click(screen.getByRole("button", { name: /show solution/i }));
    // Solutions now shown in the wrong blanks.
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("carbon dioxide");
    // Retry: reveal state must reset along with the answers.
    await user.click(screen.getByRole("button", { name: /try again/i }));
    const fresh = screen.getAllByRole("textbox");
    expect(fresh[0]).toHaveValue("");
    expect(fresh[1]).toHaveValue("");
    // Submit wrong again: nothing auto-revealed from the previous reveal.
    await user.type(fresh[0]!, "wrong");
    await user.type(fresh[1]!, "wrong");
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("wrong");
    expect(screen.getByRole("button", { name: /show solution/i })).toBeInTheDocument();
  });

  it("cloze container has no aria-live (feedback row is the announcement channel)", () => {
    const { container } = render(<Component config={cfg} onSubmit={vi.fn()} />);
    const text = container.querySelector(".kukui-fib__text");
    expect(text).not.toBeNull();
    expect(text).not.toHaveAttribute("aria-live");
    const feedback = container.querySelector(".kukui-fib__feedback");
    expect(feedback).toHaveAttribute("role", "status");
  });

  it("shows a raw/max score line with the matching band message after submit", async () => {
    const user = userEvent.setup();
    const banded: FillInTheBlanksConfig = {
      ...cfg,
      overallFeedback: [
        { from: 0, to: 50, message: "Keep practicing." },
        { from: 51, to: 100, message: "Great work!" },
      ],
    };
    render(<Component config={banded} onSubmit={vi.fn()} />);
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0]!, "carbon dioxide");
    await user.type(inputs[1]!, "oxygen");
    await user.click(screen.getByRole("button", { name: /check/i }));
    const score = screen.getByText((_, el) => el?.tagName === "OUTPUT" && /2\s*\/\s*2/.test(el.textContent ?? ""));
    expect(score).toBeInTheDocument();
    expect(screen.getByText(/great work!/i)).toBeInTheDocument();
  });

  it("spelling tolerance is bypassed for accepted answers under 3 characters", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0]!, "co2");
    // "o3" is distance 1 from "o2", but "o2"/"O2" is under 3 chars — exact only.
    await user.type(inputs[1]!, "o3");
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 2, success: false });
  });

  it("treats slashes and escaped asterisks as literal text", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const literal: FillInTheBlanksConfig = {
      version: "1.0",
      title: "Labs",
      text: "Normal fasting glucose is under *100 mg/dL*. Footnote\\* markers stay literal.",
    };
    render(<Component config={literal} onSubmit={onSubmit} />);
    // Only ONE blank: the slash does not split, the escaped * is not a marker.
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(1);
    expect(screen.getByText(/footnote\* markers stay literal/i)).toBeInTheDocument();
    await user.type(inputs[0]!, "100 mg/dL");
    await user.click(screen.getByRole("button", { name: /check/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 1, success: true });
  });

  it("persists state via onPersist on each keystroke", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0]!, "co2");
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"values":\["co2",""\]/);
  });
});
