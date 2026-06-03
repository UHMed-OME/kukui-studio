import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WebCompletionPanel } from "./WebCompletionPanel.js";
import { decodeCompletionCode } from "./web-results.js";
import type { WebResults } from "./scorm.js";

afterEach(cleanup);

const results: WebResults = { interactions: [], finishedAt: "2026-06-03T00:00:00.000Z" };

describe("WebCompletionPanel", () => {
  it("shows the percentage and a passed state with non-colour cues", () => {
    render(
      <WebCompletionPanel
        score={{ raw: 9, max: 10, success: true }}
        kind="multiple-choice"
        title="Cranial Nerves"
        getResults={() => results}
      />,
    );
    expect(screen.getByText("90%")).toBeInTheDocument();
    // "Passed" word is present, not just a colour.
    expect(screen.getByText(/Passed/)).toBeInTheDocument();
    expect(screen.getByText(/saved in this browser/i)).toBeInTheDocument();
  });

  it("renders a decodable completion code", () => {
    render(
      <WebCompletionPanel
        score={{ raw: 5, max: 10, success: false }}
        kind="quick-quiz"
        title="Pharmacology"
        getResults={() => results}
      />,
    );
    const field = screen.getByLabelText("Completion code") as HTMLInputElement;
    const decoded = decodeCompletionCode(field.value);
    expect(decoded?.k).toBe("quick-quiz");
    expect(decoded?.p).toBe(false);
    expect(decoded?.r).toBe(5);
  });

  it("offers a mailto button only when an email is configured", () => {
    const { rerender } = render(
      <WebCompletionPanel
        score={{ raw: 10, max: 10, success: true }}
        kind="flashcards"
        getResults={() => results}
      />,
    );
    expect(screen.queryByText("Email my results")).not.toBeInTheDocument();

    rerender(
      <WebCompletionPanel
        score={{ raw: 10, max: 10, success: true }}
        kind="flashcards"
        collect={{ email: "prof@uh.edu" }}
        getResults={() => results}
      />,
    );
    const link = screen.getByText("Email my results").closest("a");
    expect(link?.getAttribute("href")).toMatch(/^mailto:prof%40uh\.edu/);
  });
});
