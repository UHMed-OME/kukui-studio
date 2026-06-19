import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App.js";

// App.tsx renders <Link>s in the footer, which require a Router context.
// Tests wrap with MemoryRouter so the component mounts in isolation.
function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/studio"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Studio sidebar — activity search", () => {
  beforeEach(() => {
    // Each test gets a clean draft store so we don't leak state.
    localStorage.clear();
  });
  afterEach(() => cleanup());

  it("expands the active Bloom section by default and collapses the rest", async () => {
    const user = userEvent.setup();
    renderApp();
    const sidebar = screen.getByRole("navigation", { name: /activity type/i });
    // Studio opens on Flashcards (Remember), so that section is expanded.
    expect(within(sidebar).getByRole("button", { name: /flashcards/i }))
      .toBeInTheDocument();
    // Activities in other sections start collapsed, so they aren't rendered
    // until their section is expanded (or a search reveals them).
    expect(within(sidebar).queryByRole("button", { name: /drag and drop/i }))
      .toBeNull();
    // Searching forces every section open so matches are never hidden.
    const input = within(sidebar).getByRole("searchbox", {
      name: /search activities/i,
    });
    await user.type(input, "drag");
    expect(within(sidebar).getByRole("button", { name: /drag and drop/i }))
      .toBeInTheDocument();
  });

  it("hides non-matching activities while typing in the search input", async () => {
    const user = userEvent.setup();
    renderApp();
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
    renderApp();
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
    renderApp();
    const sidebar = screen.getByRole("navigation", { name: /activity type/i });
    const input = within(sidebar).getByRole("searchbox", {
      name: /search activities/i,
    }) as HTMLInputElement;

    await user.type(input, "flash");
    expect(within(sidebar).getByRole("button", { name: /flashcards/i }))
      .toBeInTheDocument();
    expect(
      within(sidebar).queryByRole("button", { name: /drag and drop/i }),
    ).toBeNull();

    await user.click(within(sidebar).getByRole("button", { name: /clear search/i }));
    expect(input.value).toBe("");
    // Filter is cleared; the active (Remember) section's activities show again.
    expect(within(sidebar).getByRole("button", { name: /flashcards/i }))
      .toBeInTheDocument();
  });

  it("Escape clears the query when it is non-empty", async () => {
    const user = userEvent.setup();
    renderApp();
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
