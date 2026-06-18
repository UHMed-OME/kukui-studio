import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CoursePresentationConfig } from "./schema.js";
import Component from "./Component.js";

const cfg: CoursePresentationConfig = {
  version: "1.0",
  title: "Photosynthesis basics",
  slides: [
    {
      id: "intro",
      title: "What is photosynthesis?",
      body: "<p>Plants convert light into chemical energy.</p>",
    },
    {
      id: "check",
      title: "Quick check",
      body: "<p>Answer the question.</p>",
      activity: {
        kind: "multipleChoice",
        config: {
          version: "1.0",
          title: "Energy source",
          question: "<p>What powers photosynthesis?</p>",
          answers: [
            { text: "Sunlight", correct: true },
            { text: "Moonlight", correct: false },
          ],
        },
      },
    },
    {
      id: "wrap",
      title: "Summary",
      body: "<p>You made it to the end.</p>",
    },
  ],
  appearance: { theme: "auto" },
};

describe("course-presentation Component", () => {
  it("renders the title and the first slide", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /photosynthesis basics/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/what is photosynthesis\?/i)).toBeInTheDocument();
    expect(screen.getByText(/plants convert light/i)).toBeInTheDocument();
    // The "In progress" badge is shown before finishing.
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });

  it("Next advances to the following slide", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/quick check/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/quick check/i)).toBeInTheDocument();
  });

  it("records an embedded multiple-choice score and Finish submits an aggregate", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);

    // Advance to the slide with the embedded MC.
    await user.click(screen.getByRole("button", { name: /next/i }));
    // The embedded MC renders as h2 (headingLevel min(1+1,3) = 2).
    expect(
      screen.getByRole("heading", { level: 2, name: /energy source/i }),
    ).toBeInTheDocument();

    // Answer it correctly and check.
    await user.click(screen.getByRole("button", { name: /^sunlight,/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    // Advance to the last slide and Finish.
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /finish/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 1,
      max: 1,
      success: true,
    });
  });

  it("is completion-only when no slide has an activity", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const noActivity: CoursePresentationConfig = {
      ...cfg,
      slides: [
        { id: "a", title: "One", body: "<p>One.</p>" },
        { id: "b", title: "Two", body: "<p>Two.</p>" },
      ],
    };
    render(<Component config={noActivity} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /finish/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 0,
      max: 0,
      success: true,
    });
  });

  it("renders the title as an h2 when headingLevel is 2", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} headingLevel={2} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /photosynthesis basics/i }),
    ).toBeInTheDocument();
  });

  it("persists slide index + scores and resumes from suspendData", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    const { unmount } = render(
      <Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />,
    );

    // Advance to the embedded-MC slide and answer it.
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /^sunlight,/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    const suspend = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(suspend).toMatch(/"current":1/);
    expect(suspend).toMatch(/"check"/);
    unmount();

    // Remount with the suspendData — should restore slide index 1.
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={suspend} />);
    expect(screen.getByText(/quick check/i)).toBeInTheDocument();
    // The answered slide's dot shows the answered marker.
    expect(
      screen.getByRole("button", { name: /go to slide 2 of 3.*answered/i }),
    ).toBeInTheDocument();
  });
});
