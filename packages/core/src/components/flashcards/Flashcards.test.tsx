import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FlashcardsConfig } from "@kukui/schemas";
import { Flashcards } from "./Flashcards.js";

/**
 * Flashcards / Recall Drill — these tests exercise the front→back flip,
 * the self-rated answer flow, the "didn't know" re-queue behaviour,
 * completion → onSubmit, and resume from suspendData.
 *
 * The 3D flip CSS animation is a pure visual concern — jsdom can't compute
 * transforms, so we assert via the card's `aria-pressed` state and the
 * post-flip "answer side" / "question side" accessible name instead.
 */

const cfg: FlashcardsConfig = {
  version: "1.0",
  title: "Chemistry symbols",
  prompt: "<p>Match each symbol to its element.</p>",
  cards: [
    { id: "c1", front: "<p>H</p>", back: "<p>Hydrogen</p>" },
    { id: "c2", front: "<p>O</p>", back: "<p>Oxygen</p>" },
    { id: "c3", front: "<p>Na</p>", back: "<p>Sodium</p>" },
  ],
  behaviour: { passThreshold: 80 },
};

const cfgSingle: FlashcardsConfig = {
  version: "1.0",
  title: "Single card",
  cards: [{ id: "only", front: "<p>Q</p>", back: "<p>A</p>" }],
};

function getCard() {
  return screen.getByRole("button", { name: /flashcard \d+ of \d+/i });
}

describe("Flashcards", () => {
  it("renders the first card front (question side) by default", () => {
    render(<Flashcards config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /chemistry symbols/i })).toBeInTheDocument();
    expect(screen.getByText(/match each symbol/i)).toBeInTheDocument();
    // Card 1 of 3, on the question side.
    const card = getCard();
    expect(card.getAttribute("aria-label")).toMatch(/card 1 of 3/i);
    expect(card.getAttribute("aria-label")).toMatch(/question side/i);
    expect(card.getAttribute("aria-pressed")).toBe("false");
    // Front-only "Reveal answer" CTA — back-side answer buttons not shown.
    expect(screen.getByRole("button", { name: /reveal answer/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^I knew it/i }),
    ).not.toBeInTheDocument();
  });

  it("clicking the card flips it to the back side and reveals answer buttons", async () => {
    const user = userEvent.setup();
    render(<Flashcards config={cfg} onSubmit={vi.fn()} />);
    await user.click(getCard());
    const card = getCard();
    expect(card.getAttribute("aria-pressed")).toBe("true");
    expect(card.getAttribute("aria-label")).toMatch(/answer side/i);
    expect(screen.getByRole("button", { name: /^I knew it/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^I didn't know it/i })).toBeInTheDocument();
  });

  it("'I knew it' advances to the next card and updates the knew-count", async () => {
    const user = userEvent.setup();
    render(<Flashcards config={cfg} onSubmit={vi.fn()} />);
    // Flip card 1, mark "knew it" → should advance to card 2 on the question side.
    await user.click(getCard());
    await user.click(screen.getByRole("button", { name: /^I knew it/i }));
    const card = getCard();
    expect(card.getAttribute("aria-label")).toMatch(/card 2 of 3/i);
    expect(card.getAttribute("aria-label")).toMatch(/question side/i);
    expect(screen.getByText(/knew 1 of 3 so far/i)).toBeInTheDocument();
  });

  it("'I didn't know it' re-queues the card to the back of the deck", async () => {
    const user = userEvent.setup();
    render(<Flashcards config={cfg} onSubmit={vi.fn()} />);

    // Helper: read which card front is currently visible by snapshotting the
    // front face's text.
    const currentFront = () => {
      // The aria-label has the index, but to identify the *card*, look at
      // the visible front body text. We rendered c1=H, c2=O, c3=Na.
      const el = document.querySelector(".kukui-fc__face--front .kukui-fc__face-body");
      return el?.textContent ?? "";
    };

    expect(currentFront()).toMatch(/^H/);
    // Card 1 (H): didn't know it → re-queued to tail.
    await user.click(getCard());
    await user.click(screen.getByRole("button", { name: /^I didn't know it/i }));
    expect(currentFront()).toMatch(/^O/); // moved to card 2 (O)
    // Card 2 (O): knew it.
    await user.click(getCard());
    await user.click(screen.getByRole("button", { name: /^I knew it/i }));
    expect(currentFront()).toMatch(/^Na/); // moved to card 3 (Na)
    // Card 3 (Na): knew it.
    await user.click(getCard());
    await user.click(screen.getByRole("button", { name: /^I knew it/i }));
    // The H card should have come back around (re-queued).
    expect(currentFront()).toMatch(/^H/);
  });

  it("calls onSubmit once when every card has been marked 'knew it'", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Flashcards config={cfg} onSubmit={onSubmit} />);
    // Knew all three in a row → success threshold (80%) cleared at 100%.
    for (let i = 0; i < 3; i += 1) {
      await user.click(getCard());
      await user.click(screen.getByRole("button", { name: /^I knew it/i }));
    }
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 3,
      max: 3,
      success: true,
    });
    // Summary state should now be visible.
    expect(screen.getByText(/finished — knew 3 of 3/i)).toBeInTheDocument();
  });

  it("reports success=false when the knew-it ratio is below passThreshold", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    // passThreshold = 80; if we knew 1 of 3 (~33%), success should be false.
    // To force completion despite "didn't know it" re-queues, use a
    // single-card deck so the retry cap (2) is hit cleanly.
    const cfg1: FlashcardsConfig = {
      ...cfgSingle,
      behaviour: { passThreshold: 80 },
    };
    render(<Flashcards config={cfg1} onSubmit={onSubmit} />);
    // First time: didn't know → re-queued (retry 1).
    await user.click(getCard());
    await user.click(screen.getByRole("button", { name: /^I didn't know it/i }));
    // Second time: didn't know → re-queued (retry 2).
    await user.click(getCard());
    await user.click(screen.getByRole("button", { name: /^I didn't know it/i }));
    // Third time: didn't know → cap reached, no further re-queue → completion.
    await user.click(getCard());
    await user.click(screen.getByRole("button", { name: /^I didn't know it/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 0,
      max: 1,
      success: false,
    });
  });

  it("persists state via onPersist on flip and on answer", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Flashcards config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    onPersist.mockClear();
    await user.click(getCard()); // flip
    expect(onPersist).toHaveBeenCalled();
    const afterFlip = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(afterFlip).toMatch(/"flipped":true/);
    onPersist.mockClear();
    await user.click(screen.getByRole("button", { name: /^I knew it/i }));
    expect(onPersist).toHaveBeenCalled();
    const afterAnswer = onPersist.mock.calls.at(-1)?.[0] as string;
    // After answering, the next card is shown unflipped.
    expect(afterAnswer).toMatch(/"flipped":false/);
    expect(afterAnswer).toMatch(/"c1":"knew"/);
  });

  it("resumes from a valid suspendData payload (mid-deck position)", () => {
    const suspend = JSON.stringify({
      queue: ["c2", "c3"],
      statuses: { c1: "knew", c2: "unanswered", c3: "unanswered" },
      retries: { c1: 0, c2: 0, c3: 0 },
      flipped: false,
      seed: 42,
      completed: false,
    });
    render(<Flashcards config={cfg} onSubmit={vi.fn()} suspendData={suspend} />);
    // Card 2 of 3 should be the active card; knew count 1.
    expect(screen.getByText(/knew 1 of 3 so far/i)).toBeInTheDocument();
    const front = document.querySelector(".kukui-fc__face--front .kukui-fc__face-body");
    expect(front?.textContent).toMatch(/^O/);
  });

  it("when headingLevel=2 is passed, the title renders as h2 (used by QS / CP nesting)", () => {
    render(<Flashcards config={cfg} onSubmit={vi.fn()} headingLevel={2} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /chemistry symbols/i }),
    ).toBeInTheDocument();
  });
});
