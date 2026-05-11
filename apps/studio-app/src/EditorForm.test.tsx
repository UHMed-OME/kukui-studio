import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorForm } from "./EditorForm.js";
import { STARTERS } from "./starters.js";

describe("EditorForm", () => {
  it("renders html widgets through RJSF without unsupported widget errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <EditorForm
        kind="multiple-choice"
        value={STARTERS["multiple-choice"]}
        onChange={() => {}}
      />,
    );

    expect(await screen.findByText("Question prompt")).toBeInTheDocument();
    expect(
      errorSpy.mock.calls.flat().some((arg) =>
        String(arg).includes("Unsupported widget definition"),
      ),
    ).toBe(false);

    errorSpy.mockRestore();
  });
});
