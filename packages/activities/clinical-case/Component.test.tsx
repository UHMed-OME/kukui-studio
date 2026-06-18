import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ClinicalCaseConfig } from "./schema.js";
import Component from "./Component.js";

const cfg: ClinicalCaseConfig = {
  version: "1.0",
  title: "33-year-old with facial swelling",
  week: "Week 1",
  presentation: {
    label: "Clinical Presentation",
    title: "Emergency Room",
    chiefComplaint: "<p>Rapid right-sided facial swelling after a root canal.</p>",
    vitals: [
      { value: "144/67", label: "BP (mmHg)", flag: "watch", flagText: "Elevated SBP" },
      { value: "98%", label: "O₂ Sat", flag: "normal", flagText: "Normal" },
    ],
    examFindings: [
      { type: "present", text: "<strong>Crepitus</strong> on palpation" },
      { type: "absent", text: "<strong>No fever</strong>" },
    ],
    reflectionPrompt: "💡 What is your working diagnosis?",
  },
  anatomy: {
    label: "Anatomy",
    title: "Fascial pathways",
    imagingFinding: "<p>Air tracking along the cervical fascia.</p>",
    spaces: [{ name: "Pterygomandibular Space", detail: "<p>Deep to medial pterygoid.</p>" }],
  },
  diagnosis: {
    label: "Diagnosis",
    title: "Subcutaneous emphysema",
    keyFinding: "<p>Crepitus is pathognomonic.</p>",
    differential: [
      { verdict: "out", text: "Ludwig's angina — excluded" },
      { verdict: "in", text: "Subcutaneous emphysema — confirmed" },
    ],
  },
  quiz: {
    title: "Test Your Understanding",
    questions: [
      {
        id: "q1",
        question: "Crepitus is best explained by?",
        options: ["Pus accumulation", "Subcutaneous air"],
        correctIndex: 1,
        feedbackPerOption: ["Incorrect — pus is fluctuant.", "Correct — air crackles."],
      },
      {
        id: "q2",
        question: "Which fascial layer outlines the SCM?",
        options: ["Prevertebral", "Deep investing layer"],
        correctIndex: 1,
        feedbackPerOption: ["Incorrect.", "Correct — it surrounds the SCM."],
      },
    ],
    scoreMessages: ["Keep reviewing.", "Almost there.", "Excellent — perfect score!"],
  },
  activity: {
    label: "Activity",
    title: "Choose your format",
    formats: [
      {
        id: "written",
        icon: "📄",
        name: "Written Case Analysis",
        desc: "400–600 words",
        guidance: "<p>Write 400–600 words.</p>",
        submission: "<p>Upload to Brightspace.</p>",
      },
    ],
  },
};

function gotoQuiz(getter = screen) {
  // Stepper button 4 is the Quiz section.
  const stepper = getter.getByRole("navigation", { name: /case sections/i });
  const btns = within(stepper).getAllByRole("button");
  return btns[3]!;
}

describe("ClinicalCase", () => {
  it("renders the title and the presentation section first", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /facial swelling/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Rapid right-sided facial swelling/i)).toBeInTheDocument();
    expect(screen.getByText("144/67")).toBeInTheDocument();
    // Stepper has 5 sections (presentation, anatomy, diagnosis, quiz, activity).
    const stepper = screen.getByRole("navigation", { name: /case sections/i });
    expect(within(stepper).getAllByRole("button")).toHaveLength(5);
  });

  it("navigates between sections via the stepper", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(gotoQuiz());
    expect(
      screen.getByRole("heading", { name: /test your understanding/i }),
    ).toBeInTheDocument();
  });

  it("locks a quiz question after answering and reveals per-option feedback", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(gotoQuiz());

    const wrong = screen.getByRole("button", { name: /pus accumulation/i });
    await user.click(wrong);

    // Feedback for the chosen (wrong) option is shown.
    expect(screen.getByText(/pus is fluctuant/i)).toBeInTheDocument();
    // The question is now locked — options disabled.
    expect(wrong).toBeDisabled();
    expect(screen.getByRole("button", { name: /subcutaneous air/i })).toBeDisabled();
  });

  it("submits the quiz score (raw correct / max questions) once all answered", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(gotoQuiz());

    // Answer q1 correctly, q2 incorrectly.
    await user.click(screen.getByRole("button", { name: /subcutaneous air/i }));
    await user.click(screen.getByRole("button", { name: /^prevertebral/i }));

    await user.click(screen.getByRole("button", { name: /submit quiz/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 2 });
    // Score message indexed by #correct (1) is shown.
    expect(screen.getByText(/1 of 2 correct/i)).toBeInTheDocument();
    expect(screen.getByText(/Almost there/i)).toBeInTheDocument();
  });

  it("Submit quiz is disabled until every question is answered", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(gotoQuiz());
    expect(screen.getByRole("button", { name: /submit quiz/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /subcutaneous air/i }));
    expect(screen.getByRole("button", { name: /submit quiz/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /deep investing layer/i }));
    expect(screen.getByRole("button", { name: /submit quiz/i })).toBeEnabled();
  });

  it("expands an activity format to reveal its guidance", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    const stepper = screen.getByRole("navigation", { name: /case sections/i });
    await user.click(within(stepper).getAllByRole("button")[4]!);

    const fmt = screen.getByRole("button", { name: /written case analysis/i });
    expect(fmt).toHaveAttribute("aria-expanded", "false");
    await user.click(fmt);
    expect(fmt).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Write 400–600 words/i)).toBeInTheDocument();
  });

  it("persists state via onPersist and resumes from suspendData", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    const { unmount } = render(
      <Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />,
    );
    await user.click(gotoQuiz());
    await user.click(screen.getByRole("button", { name: /subcutaneous air/i }));

    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toContain("q1");

    unmount();
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={last} />);
    // Resumes on the quiz section with q1 answered (feedback visible).
    expect(screen.getByText(/air crackles/i)).toBeInTheDocument();
  });

  it("renders the activity title as h2 when headingLevel=2", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} headingLevel={2} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /facial swelling/i }),
    ).toBeInTheDocument();
  });

  it("all-or-nothing scoring marks success only on a perfect quiz", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const aon: ClinicalCaseConfig = {
      ...cfg,
      scoring: { mode: "all-or-nothing" },
    };
    render(<Component config={aon} onSubmit={onSubmit} />);
    await user.click(gotoQuiz());
    await user.click(screen.getByRole("button", { name: /subcutaneous air/i }));
    await user.click(screen.getByRole("button", { name: /deep investing layer/i }));
    await user.click(screen.getByRole("button", { name: /submit quiz/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 2, max: 2, success: true });
  });
});
