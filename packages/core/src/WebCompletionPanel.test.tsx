import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

describe("WebCompletionPanel — webhook sender", () => {
  const collect = { webhook: "https://example.com/hook" };
  const panel = (
    <WebCompletionPanel
      score={{ raw: 8, max: 10, success: true }}
      kind="multiple-choice"
      title="Cranial Nerves"
      collect={collect}
      getResults={() => results}
    />
  );

  /** fetch stub that respects AbortSignal: rejects with AbortError on abort. */
  const abortableFetch = (signals: AbortSignal[]) =>
    vi.fn((_url: unknown, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      signals.push(signal);
      return new Promise<Response>((resolve, reject) => {
        const abort = () => reject(new DOMException("aborted", "AbortError"));
        if (signal.aborted) return abort();
        signal.addEventListener("abort", abort);
        setTimeout(() => resolve({ ok: true } as Response), 0);
      });
    });

  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("POSTs once and does not re-send on a later remount", async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = abortableFetch(signals);
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(panel);
    expect(await screen.findByText(/Results sent/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Remount (reload of a completed page) — the persisted flag short-circuits.
    unmount();
    render(panel);
    expect(screen.getByText(/Results sent/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("delivers exactly one live request under StrictMode double-mounting", async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = abortableFetch(signals);
    vi.stubGlobal("fetch", fetchMock);

    render(<StrictMode>{panel}</StrictMode>);
    expect(await screen.findByText(/Results sent/)).toBeInTheDocument();
    // StrictMode's throwaway first mount may start a request, but its
    // cleanup aborts it — only one request is ever live.
    expect(signals.filter((s) => !s.aborted)).toHaveLength(1);
  });

  it("aborts the in-flight request on unmount", () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: unknown, init?: RequestInit) => {
        signals.push(init?.signal as AbortSignal);
        return new Promise<Response>(() => {}); // never settles
      }),
    );

    const { unmount } = render(panel);
    expect(signals[0]?.aborted).toBe(false);
    unmount();
    expect(signals[0]?.aborted).toBe(true);
  });

  it("shows a manual retry on failure and posts again when clicked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(panel);
    const retry = await screen.findByText("Try again");
    fireEvent.click(retry);
    expect(await screen.findByText(/Results sent/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
