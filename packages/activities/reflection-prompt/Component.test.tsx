import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReflectionPromptConfig } from "./schema.js";
import Component from "./Component.js";

const cfgBasic: ReflectionPromptConfig = {
  version: "1.0",
  title: "Clinical Reflection",
  prompt: "<p>What stood out to you in today's case?</p>",
};

const cfgMinWords: ReflectionPromptConfig = {
  version: "1.0",
  title: "Reflection",
  prompt: "<p>Reflect on the case.</p>",
  minWords: 5,
  placeholder: "Type here...",
};

describe("reflection-prompt Component", () => {
  it("renders the title, prompt HTML, and an empty textarea", () => {
    render(<Component config={cfgBasic} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /clinical reflection/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/what stood out/i)).toBeInTheDocument();
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe("");
  });

  it("typing updates the live word count", async () => {
    const user = userEvent.setup();
    render(<Component config={cfgMinWords} onSubmit={vi.fn()} />);
    expect(screen.getByText(/^0 words$/)).toBeInTheDocument();
    expect(screen.getByText(/min: 5 words/i)).toBeInTheDocument();

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "one two three");
    expect(screen.getByText(/^3 words$/)).toBeInTheDocument();
  });

  it("Submit is disabled until minWords is met, then enables", async () => {
    const user = userEvent.setup();
    render(<Component config={cfgMinWords} onSubmit={vi.fn()} />);
    const submit = screen.getByRole("button", { name: /submit/i });
    expect(submit).toBeDisabled();

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "only four words now here");
    expect(submit).toBeEnabled();
  });

  it("Submit calls onSubmit with raw=1, max=1, success=true and text in suspendData", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfgBasic} onSubmit={onSubmit} />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "I learned a lot today.");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0]?.[0];
    expect(arg).toMatchObject({ raw: 1, max: 1, success: true });
    expect(typeof arg.suspendData).toBe("string");
    const parsed = JSON.parse(arg.suspendData);
    expect(parsed.text).toBe("I learned a lot today.");
  });

  it("after submit the textarea is read-only and shows confirmation", async () => {
    const user = userEvent.setup();
    render(<Component config={cfgBasic} onSubmit={vi.fn()} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(textarea, "Done.");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(screen.getByText(/reflection submitted/i)).toBeInTheDocument();
    expect(textarea).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
  });

  it("persists state via onPersist on each change", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(
      <Component
        config={cfgBasic}
        onSubmit={vi.fn()}
        onPersist={onPersist}
      />,
    );
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "ab");
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"text":"ab"/);
  });

  it("word counter is not a live region and is linked via aria-describedby", async () => {
    const user = userEvent.setup();
    render(<Component config={cfgMinWords} onSubmit={vi.fn()} />);

    const counter = screen.getByText(/^0 words$/).parentElement as HTMLElement;
    expect(counter).not.toHaveAttribute("aria-live");
    expect(counter).not.toHaveAttribute("role");

    const textarea = screen.getByRole("textbox");
    expect(textarea.getAttribute("aria-describedby")).toBe(counter.id);

    // The threshold crossing is announced once via a separate polite region.
    await user.type(textarea, "one two three four");
    expect(
      screen.queryByText(/minimum of 5 words reached/i),
    ).not.toBeInTheDocument();
    await user.type(textarea, " five");
    const announcement = screen.getByText(/minimum of 5 words reached/i);
    expect(announcement).toHaveAttribute("aria-live", "polite");
  });

  it("resumes in submitted state from the suspendData emitted by submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const first = render(<Component config={cfgBasic} onSubmit={onSubmit} />);
    await user.type(screen.getByRole("textbox"), "My reflection.");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    const emitted = onSubmit.mock.calls[0]?.[0].suspendData as string;
    expect(JSON.parse(emitted)).toEqual({
      stage: "submitted",
      text: "My reflection.",
    });
    first.unmount();

    render(
      <Component config={cfgBasic} onSubmit={vi.fn()} suspendData={emitted} />,
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("My reflection.");
    expect(textarea).toHaveAttribute("readonly");
    expect(screen.getByText(/reflection submitted/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
  });

  it("resumes legacy { text }-only suspendData in the writing stage", () => {
    render(
      <Component
        config={cfgBasic}
        onSubmit={vi.fn()}
        suspendData={JSON.stringify({ text: "Draft in progress" })}
      />,
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Draft in progress");
    expect(textarea).not.toHaveAttribute("readonly");
    expect(screen.queryByText(/reflection submitted/i)).not.toBeInTheDocument();
  });

  it("after submit the textarea is readOnly but NOT disabled (stays reachable)", async () => {
    const user = userEvent.setup();
    render(<Component config={cfgBasic} onSubmit={vi.fn()} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(textarea, "Done.");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(textarea).toHaveAttribute("readonly");
    expect(textarea).not.toBeDisabled();
    // Still focusable / in the tab order.
    textarea.focus();
    expect(textarea).toHaveFocus();
  });

  it("stylesheet has no dead prompt rule and uses canonical token fallbacks", () => {
    // jsdom rewrites import.meta.url to a non-file scheme, so resolve from
    // the vitest root (repo root) instead.
    const css = readFileSync(
      join(
        process.cwd(),
        "packages",
        "activities",
        "reflection-prompt",
        "Component.css",
      ),
      "utf8",
    );
    // Finding 4: dead rule removed.
    expect(css).not.toMatch(/kukui-rp__prompt/);
    // Finding 5: no stale brown-era fallback hexes remain.
    for (const stale of [
      "#dad2c6",
      "#bbae9a",
      "#7b4324",
      "#9b5830",
      "#606069",
      "#1c1e20",
      "#f2f0e8",
    ]) {
      expect(css).not.toContain(stale);
    }
    // Text on the primary fill goes through the on-primary token.
    expect(css).toContain("color: var(--color-on-primary, #ffffff)");
    expect(css).not.toMatch(/color:\s*#ffffff\s*;/);
    expect(css).not.toMatch(/color:\s*white\s*;/);
  });

  it("submitting twice is a no-op", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfgBasic} onSubmit={onSubmit} />);
    await user.type(screen.getByRole("textbox"), "Hi.");
    const button = screen.getByRole("button", { name: /submit/i });
    await user.click(button);
    // The button is now disabled; userEvent.click on a disabled button is a no-op,
    // but we also defensively guard inside submit().
    await user.click(button).catch(() => undefined);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
