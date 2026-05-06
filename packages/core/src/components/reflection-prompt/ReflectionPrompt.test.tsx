import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReflectionPromptConfig } from "@kukui/schemas";
import { ReflectionPrompt } from "./ReflectionPrompt.js";

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

describe("ReflectionPrompt", () => {
  it("renders the title, prompt HTML, and an empty textarea", () => {
    render(<ReflectionPrompt config={cfgBasic} onSubmit={vi.fn()} />);
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
    render(<ReflectionPrompt config={cfgMinWords} onSubmit={vi.fn()} />);
    expect(screen.getByText(/^0 words$/)).toBeInTheDocument();
    expect(screen.getByText(/min: 5 words/i)).toBeInTheDocument();

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "one two three");
    expect(screen.getByText(/^3 words$/)).toBeInTheDocument();
  });

  it("Submit is disabled until minWords is met, then enables", async () => {
    const user = userEvent.setup();
    render(<ReflectionPrompt config={cfgMinWords} onSubmit={vi.fn()} />);
    const submit = screen.getByRole("button", { name: /submit/i });
    expect(submit).toBeDisabled();

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "only four words now here");
    expect(submit).toBeEnabled();
  });

  it("Submit calls onSubmit with raw=1, max=1, success=true and text in suspendData", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ReflectionPrompt config={cfgBasic} onSubmit={onSubmit} />);
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
    render(<ReflectionPrompt config={cfgBasic} onSubmit={vi.fn()} />);
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
      <ReflectionPrompt
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

  it("submitting twice is a no-op", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ReflectionPrompt config={cfgBasic} onSubmit={onSubmit} />);
    await user.type(screen.getByRole("textbox"), "Hi.");
    const button = screen.getByRole("button", { name: /submit/i });
    await user.click(button);
    // The button is now disabled; userEvent.click on a disabled button is a no-op,
    // but we also defensively guard inside submit().
    await user.click(button).catch(() => undefined);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
