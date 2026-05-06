import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CoursePresentationConfig } from "@kukui/schemas";
import { CoursePresentation } from "./CoursePresentation.js";

const cfg: CoursePresentationConfig = {
  version: "1.0",
  title: "Plate Tectonics",
  slides: [
    {
      elements: [
        {
          type: "text",
          html: "<p>Welcome.</p>",
          rect: { x: 0.1, y: 0.2, w: 0.8, h: 0.5 },
        },
      ],
    },
    {
      elements: [
        {
          type: "interaction",
          kind: "multipleChoice",
          rect: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
          config: {
            version: "1.0",
            title: "Q",
            question: "<p>Pick A.</p>",
            answers: [
              { text: "A", correct: true },
              { text: "B", correct: false },
            ],
          },
        },
      ],
    },
  ],
  behaviour: { showProgressBar: true },
};

describe("CoursePresentation", () => {
  it("renders the first slide and progress indicator", () => {
    render(<CoursePresentation config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Slide 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/welcome\./i)).toBeInTheDocument();
  });

  it("Next advances to slide 2 with the embedded MC; Finish only on last slide", async () => {
    const user = userEvent.setup();
    render(<CoursePresentation config={cfg} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /finish/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/Slide 2 of 2/i)).toBeInTheDocument();
    // Embedded MC renders as h2 inside Course Presentation (heading hierarchy).
    expect(screen.getByRole("heading", { level: 2, name: /^q$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /finish/i })).toBeInTheDocument();
  });

  it("aggregates embedded MC score into the final onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CoursePresentation config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /^a,/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /finish/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 1, success: true });
  });

  it("invalid embedded interaction renders an inline error, doesn't crash", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken: CoursePresentationConfig = {
      version: "1.0",
      title: "Bad",
      slides: [
        {
          elements: [
            {
              type: "interaction",
              kind: "multipleChoice",
              rect: { x: 0, y: 0, w: 1, h: 1 },
              config: { version: "x" }, // invalid
            },
          ],
        },
      ],
    };
    render(<CoursePresentation config={broken} onSubmit={vi.fn()} />);
    expect(screen.getByText(/failed validation/i)).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("persists state via onPersist on slide nav", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<CoursePresentation config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"current":1/);
  });
});
