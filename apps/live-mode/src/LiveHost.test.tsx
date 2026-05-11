import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  __setRoomFactoryForTest,
  joinLiveRoom,
  type LiveRoomHandle,
  type Presence,
} from "@kukui/live";
import { z } from "zod";
import { LiveHost } from "./LiveHost.js";
import { InstructorConsole } from "./InstructorConsole.js";
import { StudentParticipant } from "./StudentParticipant.js";
import { installMockMeshFactory, resetMockMesh } from "./test-utils.js";

/**
 * Test loader factory — returns a stub that resolves to whatever JSON the
 * test queues up. Skips real network + skips real fetch validation; LiveHost
 * still calls `schema.parseAsync` via `loadContent`, so we use the real
 * `loadContent` style by manually invoking `safeParse` here.
 */
function makeLoader(json: unknown) {
  return async function loader(_url: string, schema: z.ZodTypeAny) {
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      // Mirror ContentLoadError shape that LiveHost handles
      const { ContentLoadError } = await import("@kukui/core");
      throw new ContentLoadError("Schema validation failed (test)", {
        issues: parsed.error.issues,
      });
    }
    return parsed.data;
  };
}

const VALID_MC = {
  version: "1.0",
  title: "Test MC",
  question: "<p>Pick one</p>",
  answers: [
    { text: "A", correct: true },
    { text: "B", correct: false },
  ],
};

const INVALID_MC = {
  version: "1.0",
  title: "Broken",
  // missing question + answers
};

function presenceOf(handle: LiveRoomHandle): Map<string, Presence> {
  return new Map(handle.presence());
}

beforeEach(() => {
  installMockMeshFactory();
});

afterEach(() => {
  __setRoomFactoryForTest(null);
  resetMockMesh();
});

describe("LiveHost", () => {
  it("loads valid JSON and renders the instructor console for role=instructor", async () => {
    const room = joinLiveRoom("roomA", {}, "p1");
    room.setPresence({ name: "Prof", role: "instructor" });

    render(
      <LiveHost
        kind="multiple-choice"
        configUrl="/fake.json"
        room={room}
        presence={presenceOf(room)}
        role="instructor"
        onLeave={vi.fn()}
        loader={makeLoader(VALID_MC)}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /instructor console/i })).toBeInTheDocument();
    });
    expect(screen.getByTestId("activity-summary")).toHaveTextContent(/Test MC/);
    // Phase progression controls are present
    expect(
      screen.getByRole("button", { name: /advance to question/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset to lobby/i })).toBeInTheDocument();
  });

  it("loads valid JSON and renders the student view for role=student", async () => {
    const room = joinLiveRoom("roomB", {}, "p1");
    room.setPresence({ name: "Stu", role: "student" });

    render(
      <LiveHost
        kind="multiple-choice"
        configUrl="/fake.json"
        room={room}
        presence={presenceOf(room)}
        role="student"
        onLeave={vi.fn()}
        loader={makeLoader(VALID_MC)}
      />,
    );

    await waitFor(() => {
      // Student view uses the config title as its heading
      expect(screen.getByRole("heading", { name: /test mc/i })).toBeInTheDocument();
    });

    // No phase controls on the student view
    expect(
      screen.queryByRole("button", { name: /advance to/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reset to lobby/i }),
    ).not.toBeInTheDocument();
  });

  it("rejects invalid JSON with a clear error", async () => {
    const room = joinLiveRoom("roomC", {}, "p1");
    room.setPresence({ name: "Prof", role: "instructor" });

    render(
      <LiveHost
        kind="multiple-choice"
        configUrl="/broken.json"
        room={room}
        presence={presenceOf(room)}
        role="instructor"
        onLeave={vi.fn()}
        loader={makeLoader(INVALID_MC)}
      />,
    );

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/could not load activity/i)).toBeInTheDocument();
  });
});

describe("Phase propagation across peers", () => {
  it("instructor's setPhase reaches the student on the same mocked room", async () => {
    const user = userEvent.setup();

    // Two peers, same room code → same Y.Doc via the mock mesh
    const instructorRoom = joinLiveRoom("shared", {}, "instr");
    instructorRoom.setPresence({ name: "Prof", role: "instructor" });
    const studentRoom = joinLiveRoom("shared", {}, "stud");
    studentRoom.setPresence({ name: "Stu", role: "student" });

    const presence = presenceOf(instructorRoom);

    render(
      <div>
        <div data-testid="instructor-pane">
          <InstructorConsole
            room={instructorRoom}
            presence={presence}
            activityKind="multiple-choice"
            configSummary={{ title: "Test", version: "1.0" }}
            onLoadDemo={vi.fn()}
            hasDemoLoaded={true}
            onLeave={vi.fn()}
          />
        </div>
        <div data-testid="student-pane">
          <StudentParticipant
            room={studentRoom}
            presence={presence}
            activityKind="multiple-choice"
            configTitle="Test"
            onLeave={vi.fn()}
          />
        </div>
      </div>,
    );

    const instructorPane = screen.getByTestId("instructor-pane");
    const studentPane = screen.getByTestId("student-pane");

    // Both start at "lobby"
    expect(within(instructorPane).getByTestId("phase-label")).toHaveTextContent(/lobby/i);
    expect(within(studentPane).getByTestId("phase-label")).toHaveTextContent(/lobby/i);

    // Instructor advances to "question"
    await user.click(
      within(instructorPane).getByRole("button", { name: /advance to question/i }),
    );

    // Student observes the new phase
    await waitFor(() => {
      expect(within(studentPane).getByTestId("phase-label")).toHaveTextContent(/question/i);
    });
    expect(within(instructorPane).getByTestId("phase-label")).toHaveTextContent(/question/i);
  });
});

describe("InstructorConsole — Reset to lobby", () => {
  it("returns the room phase to lobby after confirm", async () => {
    const user = userEvent.setup();
    const room = joinLiveRoom("resetRoom", {}, "instr");
    room.setPresence({ name: "Prof", role: "instructor" });

    render(
      <InstructorConsole
        room={room}
        presence={presenceOf(room)}
        activityKind="multiple-choice"
        configSummary={{ title: "Test", version: "1.0" }}
        onLoadDemo={vi.fn()}
        hasDemoLoaded={true}
        onLeave={vi.fn()}
      />,
    );

    // Advance lobby → question → reveal
    await user.click(screen.getByRole("button", { name: /advance to question/i }));
    await waitFor(() => {
      expect(screen.getByTestId("phase-label")).toHaveTextContent(/question/i);
    });
    await user.click(screen.getByRole("button", { name: /advance to reveal/i }));
    await waitFor(() => {
      expect(screen.getByTestId("phase-label")).toHaveTextContent(/reveal/i);
    });

    // Reset (two-step confirm)
    await user.click(screen.getByRole("button", { name: /reset to lobby/i }));
    await user.click(screen.getByRole("button", { name: /confirm reset/i }));

    await waitFor(() => {
      expect(screen.getByTestId("phase-label")).toHaveTextContent(/lobby/i);
    });
  });
});

describe("StudentParticipant", () => {
  it("does not expose phase controls or a 'Load demo' button", () => {
    const room = joinLiveRoom("studentRoom", {}, "stud");
    room.setPresence({ name: "Stu", role: "student" });

    render(
      <StudentParticipant
        room={room}
        presence={presenceOf(room)}
        activityKind="multiple-choice"
        configTitle="Test"
        onLeave={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /advance to/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset to lobby/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /load demo activity/i }),
    ).not.toBeInTheDocument();
    // Leave button is still allowed
    expect(screen.getByRole("button", { name: /leave room/i })).toBeInTheDocument();
  });

  // Confirms the phase banner reflects external phase changes (e.g., from
  // the instructor's Y.Doc writes).
  it("reflects external phase changes via the shared Y.Doc", async () => {
    const studentRoom = joinLiveRoom("phaseRoom", {}, "stud");
    studentRoom.setPresence({ name: "Stu", role: "student" });
    const instructorRoom = joinLiveRoom("phaseRoom", {}, "instr");
    instructorRoom.setPresence({ name: "Prof", role: "instructor" });

    render(
      <StudentParticipant
        room={studentRoom}
        presence={presenceOf(studentRoom)}
        activityKind="multiple-choice"
        configTitle="Test"
        onLeave={vi.fn()}
      />,
    );
    expect(screen.getByTestId("phase-label")).toHaveTextContent(/lobby/i);

    // Instructor writes "discussion" directly via the shared doc
    const { getRoomState } = await import("@kukui/live");
    act(() => {
      getRoomState(instructorRoom).setPhase("discussion");
    });

    await waitFor(() => {
      expect(screen.getByTestId("phase-label")).toHaveTextContent(/discussion/i);
    });
  });
});
