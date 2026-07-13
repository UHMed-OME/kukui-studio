import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Preview } from "./Preview.js";

/**
 * The "test as learner" harness: Live preview simulates the delivered
 * runtime's persistence contract (suspendData in, onPersist/onSubmit out)
 * so authors can exercise resume, gating, and completed states in Studio.
 * Driven through the real multiple-choice component (lightest activity).
 */

const mcConfig = {
  version: "1.0",
  title: "Attempt harness check",
  question: "<p>Pick the right answer.</p>",
  answers: [
    { text: "Right", correct: true },
    { text: "Wrong", correct: false },
  ],
};

function renderPreview(mode: "live" | "edit" = "live") {
  return render(
    <Preview
      kind="multiple-choice"
      value={mcConfig}
      mode={mode}
      onChange={() => {}}
    />,
  );
}

describe("Preview attempt harness", () => {
  it("shows the attempt bar with a result chip after submitting", async () => {
    const user = userEvent.setup();
    renderPreview();
    expect(
      await screen.findByText(/testing as a learner/i),
    ).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /right/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    await waitFor(() =>
      expect(screen.getByText(/submitted: 1\/1 \(passed\)/i)).toBeInTheDocument(),
    );
  });

  it("restores the attempt across a remount (Edit/Live toggle)", async () => {
    const user = userEvent.setup();
    const view = renderPreview();
    await user.click(await screen.findByRole("button", { name: /right/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await waitFor(() =>
      expect(screen.getByText(/submitted: 1\/1/i)).toBeInTheDocument(),
    );

    // Toggle to Edit (unmounts the live activity) and back to Live.
    view.rerender(
      <Preview kind="multiple-choice" value={mcConfig} mode="edit" onChange={() => {}} />,
    );
    view.rerender(
      <Preview kind="multiple-choice" value={mcConfig} mode="live" onChange={() => {}} />,
    );

    // The restored attempt is submitted: the score line renders instead of
    // an answerable Check button.
    await waitFor(() => expect(screen.getByText(/1 \/ 1/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^check$/i })).not.toBeInTheDocument();
  });

  it("Reset attempt clears the stored state and restarts fresh", async () => {
    const user = userEvent.setup();
    renderPreview();
    await user.click(await screen.findByRole("button", { name: /right/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await waitFor(() =>
      expect(screen.getByText(/submitted: 1\/1/i)).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /reset attempt/i }));

    // Fresh mount: answer buttons are enabled again and the chip is gone.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /right/i })).toBeEnabled(),
    );
    expect(screen.queryByText(/submitted: 1\/1/i)).not.toBeInTheDocument();
    expect(screen.getByText(/testing as a learner/i)).toBeInTheDocument();
  });
});
