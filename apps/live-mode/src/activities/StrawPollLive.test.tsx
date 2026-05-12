import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as Y from "yjs";
import type { StrawPollConfig } from "@kukui/schemas";
import type { LiveRoomHandle, Presence } from "@kukui/live";
import { StrawPollLive } from "./StrawPollLive.js";

/**
 * StrawPollLive tests use a hand-rolled in-memory LiveRoomHandle so we
 * exercise the Y.js vote logic without dragging in Trystero / the
 * BitTorrent signaling layer. Two handles wired to the same Y.Doc
 * simulate the instructor-and-student-share-state case the live mesh
 * provides at runtime.
 */
function makeHandle(participantId: string, doc?: Y.Doc): LiveRoomHandle {
  const sharedDoc = doc ?? new Y.Doc();
  return {
    code: "test-room",
    doc: sharedDoc,
    participantId,
    backend: "nostr",
    setPresence: () => {},
    presence: () => new Map(),
    onPeerJoin: () => () => {},
    onPeerLeave: () => () => {},
    leave: () => sharedDoc.destroy(),
  };
}

const config: StrawPollConfig = {
  version: "1.0",
  title: "Pulse check",
  prompt: "How are you doing?",
  choices: [
    { id: "great", label: "Great" },
    { id: "okay", label: "Okay" },
    { id: "rough", label: "Rough" },
  ],
};

const presence: Map<string, Presence> = new Map();

afterEach(() => cleanup());

describe("StrawPollLive", () => {
  beforeEach(() => {
    presence.clear();
  });

  it("student sees the waiting state in lobby phase, no voting buttons", () => {
    const room = makeHandle("student-1");
    render(
      <StrawPollLive
        room={room}
        presence={presence}
        role="student"
        config={config}
        onLeave={vi.fn()}
      />,
    );
    expect(screen.getByText(/waiting for the instructor/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /great/i })).not.toBeInTheDocument();
  });

  it("instructor advances lobby → question, students get voting buttons", async () => {
    const doc = new Y.Doc();
    const instructor = makeHandle("instructor-1", doc);
    const student = makeHandle("student-1", doc);
    const user = userEvent.setup();

    render(
      <StrawPollLive
        room={instructor}
        presence={presence}
        role="instructor"
        config={config}
        onLeave={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /open poll/i }));
    cleanup();

    render(
      <StrawPollLive
        room={student}
        presence={presence}
        role="student"
        config={config}
        onLeave={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /^Great/i })).toBeInTheDocument();
  });

  it("student's vote appears in instructor's tally", async () => {
    const doc = new Y.Doc();
    const instructor = makeHandle("instructor-1", doc);
    const student = makeHandle("student-1", doc);

    // Skip the lobby — set phase directly via the room state controller.
    const roomMap = doc.getMap<unknown>("__room__");
    roomMap.set("phase", "question");

    const user = userEvent.setup();
    render(
      <StrawPollLive
        room={student}
        presence={presence}
        role="student"
        config={config}
        onLeave={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Great/i }));
    cleanup();

    render(
      <StrawPollLive
        room={instructor}
        presence={presence}
        role="instructor"
        config={config}
        onLeave={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 vote cast/i)).toBeInTheDocument();
    // The "Great" row in the tally should show 1.
    const liveTallyHeading = screen.getByRole("heading", { name: /live tally/i });
    const section = liveTallyHeading.closest("section");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getAllByText("1").length).toBeGreaterThan(0);
  });

  it("re-voting replaces the previous vote (CRDT last-write-wins)", async () => {
    const doc = new Y.Doc();
    const student = makeHandle("student-1", doc);
    const roomMap = doc.getMap<unknown>("__room__");
    roomMap.set("phase", "question");

    const user = userEvent.setup();
    render(
      <StrawPollLive
        room={student}
        presence={presence}
        role="student"
        config={config}
        onLeave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Great/i }));
    await user.click(screen.getByRole("button", { name: /^Okay/i }));

    const votesMap = doc.getMap<string>("straw-poll-votes");
    expect(votesMap.get("student-1")).toBe("okay");
    expect(votesMap.size).toBe(1);
  });

  it("respects allowChangeVote: false — second tap is ignored", async () => {
    const doc = new Y.Doc();
    const student = makeHandle("student-1", doc);
    const roomMap = doc.getMap<unknown>("__room__");
    roomMap.set("phase", "question");

    const user = userEvent.setup();
    render(
      <StrawPollLive
        room={student}
        presence={presence}
        role="student"
        config={{ ...config, behaviour: { allowChangeVote: false } }}
        onLeave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Great/i }));
    // Second tap on a different choice should be a no-op (fieldset disabled).
    const okayBtn = screen.getByRole("button", { name: /^Okay/i });
    expect(okayBtn).toBeDisabled();

    const votesMap = doc.getMap<string>("straw-poll-votes");
    expect(votesMap.get("student-1")).toBe("great");
  });
});
