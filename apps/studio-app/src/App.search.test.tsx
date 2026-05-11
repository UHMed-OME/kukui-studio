import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.js";

describe("Studio sidebar — activity search", () => {
  beforeEach(() => {
    // Each test gets a clean draft store so we don't leak state.
    localStorage.clear();
  });
  afterEach(() => cleanup());

  it("renders every Bloom-grouped activity by default", () => {
    render(<App />);
    const sidebar = screen.getByRole("navigation", { name: /activity type/i });
    expect(within(sidebar).getByRole("button", { name: /flashcards/i }))
      .toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /drag and drop/i }))
      .toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /lab panel/i }))
      .toBeInTheDocument();
  });

  it("hides non-matching activities while typing in the search input", async () => {
    const user = userEvent.setup();
    render(<App />);
    const sidebar = screen.getByRole("navigation", { name: /activity type/i });
    const input = within(sidebar).getByRole("searchbox", {
      name: /search activities/i,
    });

    await user.type(input, "flash");

    expect(within(sidebar).getByRole("button", { name: /flashcards/i }))
      .toBeInTheDocument();
    // "drag and drop" should not match "flash".
    expect(
      within(sidebar).queryByRole("button", { name: /drag and drop/i }),
    ).toBeNull();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    render(<App />);
    const sidebar = screen.getByRole("navigation", { name: /activity type/i });
    const input = within(sidebar).getByRole("searchbox", {
      name: /search activities/i,
    });

    await user.type(input, "xyzzy");

    expect(within(sidebar).getByText(/no activities match "xyzzy"/i))
      .toBeInTheDocument();
  });

  it("clears the search via the clear button", async () => {
    const user = userEvent.setup();
    render(<App />);
    const sidebar = screen.getByRole("navigation", { name: /activity type/i });
    const input = within(sidebar).getByRole("searchbox", {
      name: /search activities/i,
    }) as HTMLInputElement;

    await user.type(input, "flash");
    expect(
      within(sidebar).queryByRole("button", { name: /drag and drop/i }),
    ).toBeNull();

    await user.click(within(sidebar).getByRole("button", { name: /clear search/i }));
    expect(input.value).toBe("");
    expect(within(sidebar).getByRole("button", { name: /drag and drop/i }))
      .toBeInTheDocument();
  });

  it("Escape clears the query when it is non-empty", async () => {
    const user = userEvent.setup();
    render(<App />);
    const sidebar = screen.getByRole("navigation", { name: /activity type/i });
    const input = within(sidebar).getByRole("searchbox", {
      name: /search activities/i,
    }) as HTMLInputElement;

    await user.type(input, "flash");
    expect(input.value).toBe("flash");
    await user.keyboard("{Escape}");
    expect(input.value).toBe("");
  });
});
