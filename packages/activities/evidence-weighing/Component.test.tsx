import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EvidenceWeighingConfig } from "@kukui/schemas";
import Component from "./Component.js";
import uiSchema from "./ui-schema.js";

// jsdom rewrites import.meta.url to a non-file scheme, and Vitest's CSS
// handling intercepts `?raw` imports, so resolve from the vitest root
// (repo root) instead — same approach as reflection-prompt.
const css = readFileSync(
  join(process.cwd(), "packages", "activities", "evidence-weighing", "Component.css"),
  "utf8",
);

const cfg: EvidenceWeighingConfig = {
  version: "1.0",
  title: "Evidence for Photosynthesis",
  ratings: [
    { id: "weak", label: "Weak" },
    { id: "moderate", label: "Moderate" },
    { id: "strong", label: "Strong" },
  ],
  claims: [
    {
      claim: "A plant is actively performing photosynthesis.",
      evidence: [
        {
          text: "The plant has green leaves.",
          expectedRating: "weak",
          feedback: "Green leaves alone do not confirm photosynthesis.",
        },
        {
          text: "The plant releases oxygen.",
          expectedRating: "strong",
          feedback: "Oxygen release supports photosynthesis.",
        },
      ],
    },
    {
      claim: "A plant is experiencing water stress.",
      evidence: [
        {
          text: "The plant has wilting leaves.",
          expectedRating: "moderate",
          feedback: "Wilting can indicate water stress.",
        },
        {
          text: "The soil moisture is very low.",
          expectedRating: "strong",
          feedback: "Low soil moisture supports water stress.",
        },
      ],
    },
  ],
  behaviour: {
    enableRetry: true,
    enableSolutionsButton: true,
  },
};

// Find one claim's section by its heading.
function getClaim(index: number) {
  return screen.getByRole("region", {
    name: `Claim ${index}`,
  });
}

// Select a rating for an evidence item within one claim.
async function rate(
  user: ReturnType<typeof userEvent.setup>,
  claimIndex: number,
  evidenceIndex: number,
  rating: string,
) {
  const claim = getClaim(claimIndex);
  const evidence = claim.querySelectorAll(".kukui-ew__evidence")[
    evidenceIndex
  ];

  if (!evidence) {
    throw new Error("Evidence item not found");
  }

  await user.click(
    within(evidence as HTMLElement).getByRole("radio", {
      name: rating,
    }),
  );
}

// Submit one claim using its own Check button.
async function checkClaim(
  user: ReturnType<typeof userEvent.setup>,
  claimIndex: number,
) {
  await user.click(
    within(getClaim(claimIndex)).getByRole("button", {
      name: /^check$/i,
    }),
  );
}

describe("Component", () => {
  it("renders the title, multiple claims, and their evidence", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Evidence for Photosynthesis",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/actively performing photosynthesis/i))
      .toBeInTheDocument();

    expect(screen.getByText(/experiencing water stress/i))
      .toBeInTheDocument();

    expect(screen.getByText(/green leaves/i))
      .toBeInTheDocument();

    expect(screen.getByText(/soil moisture is very low/i))
      .toBeInTheDocument();

    // Four evidence items with three rating options each.
    expect(screen.getAllByRole("radio")).toHaveLength(12);

    expect(
      screen.getAllByRole("button", { name: /^check$/i }),
    ).toHaveLength(2);
  });

  it("disables each Check button until its own evidence is rated", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);

    const firstCheck = within(getClaim(1)).getByRole("button", {
      name: /^check$/i,
    });
    const secondCheck = within(getClaim(2)).getByRole("button", {
      name: /^check$/i,
    });

    expect(firstCheck).toBeDisabled();
    expect(secondCheck).toBeDisabled();

    await rate(user, 1, 0, "Weak");

    expect(firstCheck).toBeDisabled();

    await rate(user, 1, 1, "Strong");

    expect(firstCheck).toBeEnabled();
    expect(secondCheck).toBeDisabled();
  });

  it("allows one claim to be submitted independently", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Component config={cfg} onSubmit={onSubmit} />);

    await rate(user, 1, 0, "Weak");
    await rate(user, 1, 1, "Strong");
    await checkClaim(user, 1);

    expect(
      within(getClaim(1)).getByText("2 / 2"),
    ).toBeInTheDocument();

    expect(
      within(getClaim(2)).getByRole("button", {
        name: /^check$/i,
      }),
    ).toBeDisabled();

    expect(within(getClaim(1)).getAllByRole("radio")[0])
      .toBeDisabled();

    expect(within(getClaim(2)).getAllByRole("radio")[0])
      .toBeEnabled();

    // Overall activity is not complete yet.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reports the combined score after all claims are submitted", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Component config={cfg} onSubmit={onSubmit} />);

    // Claim 1: 2 / 2.
    await rate(user, 1, 0, "Weak");
    await rate(user, 1, 1, "Strong");
    await checkClaim(user, 1);

    expect(onSubmit).not.toHaveBeenCalled();

    // Claim 2: 1 / 2.
    await rate(user, 2, 0, "Weak");
    await rate(user, 2, 1, "Strong");
    await checkClaim(user, 2);

    expect(onSubmit).toHaveBeenCalledTimes(1);

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 3,
      max: 4,
      success: false,
    });
  });

  it("reports success when every evidence rating is correct", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Component config={cfg} onSubmit={onSubmit} />);

    await rate(user, 1, 0, "Weak");
    await rate(user, 1, 1, "Strong");
    await checkClaim(user, 1);

    await rate(user, 2, 0, "Moderate");
    await rate(user, 2, 1, "Strong");
    await checkClaim(user, 2);

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      raw: 4,
      max: 4,
      success: true,
    });
  });

  it("shows feedback only for the submitted claim", async () => {
    const user = userEvent.setup();

    render(<Component config={cfg} onSubmit={vi.fn()} />);

    await rate(user, 1, 0, "Weak");
    await rate(user, 1, 1, "Strong");
    await checkClaim(user, 1);

    expect(
      screen.getByText(/green leaves alone do not confirm/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/oxygen release supports photosynthesis/i),
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/wilting can indicate water stress/i),
    ).not.toBeInTheDocument();
  });

  it("Try again resets only the selected claim", async () => {
    const user = userEvent.setup();

    render(<Component config={cfg} onSubmit={vi.fn()} />);

    await rate(user, 1, 0, "Weak");
    await rate(user, 1, 1, "Strong");
    await checkClaim(user, 1);

    await rate(user, 2, 0, "Moderate");

    await user.click(
      within(getClaim(1)).getByRole("button", {
        name: /try again/i,
      }),
    );

    const firstRadios = within(getClaim(1)).getAllByRole("radio");

    for (const radio of firstRadios) {
      expect(radio).not.toBeChecked();
    }

    expect(
      within(getClaim(1)).getByRole("button", {
        name: /^check$/i,
      }),
    ).toBeDisabled();

    const secondEvidence = getClaim(2).querySelectorAll(
      ".kukui-ew__evidence",
    )[0] as HTMLElement;

    expect(
      within(secondEvidence).getByRole("radio", {
        name: "Moderate",
      }),
    ).toBeChecked();
  });

  it("Show solution affects only the selected claim", async () => {
    const user = userEvent.setup();

    render(<Component config={cfg} onSubmit={vi.fn()} />);

    await rate(user, 1, 0, "Moderate");
    await rate(user, 1, 1, "Moderate");
    await checkClaim(user, 1);

    await rate(user, 2, 0, "Weak");
    await rate(user, 2, 1, "Weak");
    await checkClaim(user, 2);

    expect(screen.queryByText(/expected rating:/i))
      .not.toBeInTheDocument();

    await user.click(
      within(getClaim(1)).getByRole("button", {
        name: /show solution/i,
      }),
    );

    expect(
      within(getClaim(1)).getAllByText(/expected rating:/i),
    ).toHaveLength(2);

    expect(
      within(getClaim(2)).queryByText(/expected rating:/i),
    ).not.toBeInTheDocument();

    expect(
      within(getClaim(2)).getByRole("button", {
        name: /show solution/i,
      }),
    ).toBeInTheDocument();
  });

  it("hides Show solution when disabled in the configuration", async () => {
    const user = userEvent.setup();

    const noSolutions: EvidenceWeighingConfig = {
      ...cfg,
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: false,
      },
    };

    render(<Component config={noSolutions} onSubmit={vi.fn()} />);

    await rate(user, 1, 0, "Weak");
    await rate(user, 1, 1, "Strong");
    await checkClaim(user, 1);

    expect(
      screen.queryByRole("button", { name: /show solution/i }),
    ).not.toBeInTheDocument();
  });

  it("persists selections for each claim separately", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();

    render(
      <Component
        config={cfg}
        onSubmit={vi.fn()}
        onPersist={onPersist}
      />,
    );

    await rate(user, 1, 0, "Weak");
    await rate(user, 2, 0, "Moderate");

    const saved = JSON.parse(
      onPersist.mock.calls.at(-1)?.[0] as string,
    );

    expect(saved.claims[0].ratings).toEqual({ "0": "weak" });
    expect(saved.claims[1].ratings).toEqual({ "0": "moderate" });
  });

  it("includes all claim states in submitted suspendData", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Component config={cfg} onSubmit={onSubmit} />);

    await rate(user, 1, 0, "Weak");
    await rate(user, 1, 1, "Strong");
    await checkClaim(user, 1);

    await rate(user, 2, 0, "Moderate");
    await rate(user, 2, 1, "Strong");
    await checkClaim(user, 2);

    const payload = onSubmit.mock.calls[0]?.[0] as {
      suspendData: string;
    };

    const saved = JSON.parse(payload.suspendData);

    expect(saved.claims).toHaveLength(2);

    expect(saved.claims[0]).toMatchObject({
      stage: "submitted",
      attempts: 1,
      ratings: { "0": "weak", "1": "strong" },
    });

    expect(saved.claims[1]).toMatchObject({
      stage: "submitted",
      attempts: 1,
      ratings: { "0": "moderate", "1": "strong" },
    });
  });

  it("restores saved progress independently for each claim", () => {
    const saved = JSON.stringify({
      claims: [
        {
          stage: "submitted",
          ratings: { "0": "weak", "1": "strong" },
          attempts: 1,
          solutionsRevealed: false,
        },
        {
          stage: "answering",
          ratings: { "0": "moderate" },
          attempts: 0,
          solutionsRevealed: false,
        },
      ],
    });

    render(
      <Component
        config={cfg}
        onSubmit={vi.fn()}
        suspendData={saved}
      />,
    );

    expect(
      within(getClaim(1)).getByText("2 / 2"),
    ).toBeInTheDocument();

    expect(
      within(getClaim(2)).getByRole("button", {
        name: /^check$/i,
      }),
    ).toBeDisabled();

    const secondEvidence = getClaim(2).querySelectorAll(
      ".kukui-ew__evidence",
    )[0] as HTMLElement;

    expect(
      within(secondEvidence).getByRole("radio", {
        name: "Moderate",
      }),
    ).toBeChecked();
  });

  it("uses separate radio groups across all claims", async () => {
    const user = userEvent.setup();

    render(<Component config={cfg} onSubmit={vi.fn()} />);

    await rate(user, 1, 0, "Weak");
    await rate(user, 2, 0, "Strong");

    const firstEvidence = getClaim(1).querySelectorAll(
      ".kukui-ew__evidence",
    )[0] as HTMLElement;

    const secondEvidence = getClaim(2).querySelectorAll(
      ".kukui-ew__evidence",
    )[0] as HTMLElement;

    expect(
      within(firstEvidence).getByRole("radio", {
        name: "Weak",
      }),
    ).toBeChecked();

    expect(
      within(secondEvidence).getByRole("radio", {
        name: "Strong",
      }),
    ).toBeChecked();

    const firstName = within(firstEvidence)
      .getByRole("radio", { name: "Weak" })
      .getAttribute("name");

    const secondName = within(secondEvidence)
      .getByRole("radio", { name: "Strong" })
      .getAttribute("name");

    expect(firstName).not.toBe(secondName);
  });

  it("renders the title at the requested heading level", () => {
    render(
      <Component
        config={cfg}
        onSubmit={vi.fn()}
        headingLevel={2}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Evidence for Photosynthesis",
      }),
    ).toBeInTheDocument();
  });
});

describe("Component.css tokens", () => {
  it("uses the on-primary token for text on primary fills", () => {
    expect(css).toContain("var(--color-on-primary, #ffffff)");
    expect(css).not.toMatch(/color:\s*#ffffff\s*;/);
  });

  it("has no stale fallback hexes", () => {
    for (const stale of [
      "#7b4324",
      "#9b5830",
      "#dad2c6",
      "#606069",
      "#bbae9a",
    ]) {
      expect(css).not.toContain(stale);
    }

    expect(css).toContain("var(--color-primary, #4a7a5f)");
    expect(css).toContain("var(--color-primary-hover, #3f6b52)");
    expect(css).toContain("var(--color-border, #d1d7df)");
    expect(css).toContain("var(--color-text-secondary, #49515b)");
  });
});

describe("ui-schema", () => {
  it("inlines the APPEARANCE fragment with the curated Color scheme label", () => {
    const appearance = (
      uiSchema as Record<string, unknown>
    ).appearance as {
      "ui:title": string;
      theme: {
        "ui:title": string;
        "ui:help": string;
      };
    };

    expect(appearance["ui:title"]).toBe("Appearance");
    expect(appearance.theme["ui:title"]).toBe("Color scheme");
    expect(appearance.theme["ui:help"]).toMatch(
      /auto.*lets the os decide/i,
    );
  });
});
