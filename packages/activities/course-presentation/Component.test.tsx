import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CoursePresentationConfig } from "./schema.js";
import Component from "./Component.js";

const img = (alt: string) => ({
  kind: "image" as const,
  src: "https://example.test/slide.png",
  alt,
  naturalWidth: 1280,
  naturalHeight: 720,
});

const cfg: CoursePresentationConfig = {
  version: "1.0",
  title: "Photosynthesis basics",
  slides: [
    {
      id: "intro",
      title: "What is photosynthesis?",
      background: img("Intro slide"),
      overlays: [
        {
          kind: "info",
          id: "i1",
          rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
          label: "Key term",
          html: "<p>Chlorophyll absorbs light.</p>",
        },
      ],
    },
    {
      id: "check",
      title: "Quick check",
      background: img("Check slide"),
      overlays: [
        {
          kind: "checkpoint",
          id: "c1",
          rect: { x: 0.5, y: 0.5, w: 0.2, h: 0.1 },
          required: true,
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
      ],
    },
    {
      id: "wrap",
      title: "Summary",
      background: { kind: "blank" },
      notes: "<p>You made it to the end.</p>",
      overlays: [],
    },
  ],
  appearance: { theme: "auto" },
};

describe("course-presentation Component", () => {
  it("renders the title and the first slide image", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /photosynthesis basics/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/what is photosynthesis\?/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /intro slide/i })).toBeInTheDocument();
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });

  it("reveals an info hotspot's content when its marker is clicked", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/chlorophyll absorbs light/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /key term/i }));
    expect(screen.getByText(/chlorophyll absorbs light/i)).toBeInTheDocument();
  });

  it("Next advances to the following slide", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/quick check/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/quick check/i)).toBeInTheDocument();
  });

  it("blocks Next on a required, unanswered checkpoint until it is answered", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /next/i })); // → check slide

    // Required checkpoint not yet answered: Next is disabled + a gate hint shows.
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    expect(screen.getByText(/answer the required checkpoint/i)).toBeInTheDocument();

    // Open the checkpoint, answer correctly, check.
    await user.click(screen.getByRole("button", { name: /question.*required/i }));
    await user.click(screen.getByRole("button", { name: /sunlight/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  it("aggregates checkpoint scores and Finish submits them", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /next/i })); // → check
    await user.click(screen.getByRole("button", { name: /question.*required/i }));
    await user.click(screen.getByRole("button", { name: /sunlight/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    await user.click(screen.getByRole("button", { name: /next/i })); // → wrap
    await user.click(screen.getByRole("button", { name: /finish/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 1, success: true });
  });

  it("is completion-only when no slide has a checkpoint", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const noCheckpoints: CoursePresentationConfig = {
      ...cfg,
      slides: [
        { id: "a", title: "One", background: img("One"), overlays: [] },
        { id: "b", title: "Two", background: { kind: "blank" }, overlays: [] },
      ],
    };
    render(<Component config={noCheckpoints} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /finish/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 0, max: 0, success: true });
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

    await user.click(screen.getByRole("button", { name: /next/i })); // → check
    await user.click(screen.getByRole("button", { name: /question.*required/i }));
    await user.click(screen.getByRole("button", { name: /sunlight/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    const suspend = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(suspend).toMatch(/"current":1/);
    expect(suspend).toMatch(/check:c1/);
    unmount();

    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={suspend} />);
    expect(screen.getByText(/quick check/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /go to slide 2 of 3.*answered/i }),
    ).toBeInTheDocument();
  });
});
