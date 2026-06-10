import { describe, expect, it, afterEach } from "vitest";
import { act, renderHook, cleanup } from "@testing-library/react";
import * as Y from "yjs";
import type { LiveRoomHandle } from "@kukui/live";
import type { IsometricChatroomConfig } from "@kukui/schemas";
import { usePhase } from "../usePhase.js";
import { useStrawPoll } from "./useStrawPoll.js";
import { useQABoard } from "./useQABoard.js";
import { useWordCloud } from "./useWordCloud.js";
import { useConfidenceMeter } from "./useConfidenceMeter.js";
import { useIsometricChatroom } from "./useIsometricChatroom.js";

/**
 * Role guards are local speed-bumps only — in P2P mode every client holds
 * the shared doc, so integrity is advisory. These tests pin down the
 * speed-bump: destructive mutators must no-op for role="student" and work
 * for role="instructor".
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

afterEach(() => cleanup());

describe("usePhase role guard", () => {
  it("student setPhase is a no-op; instructor setPhase writes", () => {
    const doc = new Y.Doc();
    const student = renderHook(() => usePhase(makeHandle("stud", doc), "student"));
    act(() => student.result.current.setPhase("question"));
    expect(student.result.current.phase).toBe("lobby");

    const instructor = renderHook(() =>
      usePhase(makeHandle("instr", doc), "instructor"),
    );
    act(() => instructor.result.current.setPhase("question"));
    expect(instructor.result.current.phase).toBe("question");
  });
});

describe("useStrawPoll role guard", () => {
  it("student clearAll is a no-op; instructor clearAll clears", () => {
    const doc = new Y.Doc();
    const votes = doc.getMap<string>("straw-poll-votes");
    votes.set("someone", "great");

    const student = renderHook(() =>
      useStrawPoll(makeHandle("stud", doc), ["great"], "student"),
    );
    act(() => student.result.current.clearAll());
    expect(votes.size).toBe(1);

    const instructor = renderHook(() =>
      useStrawPoll(makeHandle("instr", doc), ["great"], "instructor"),
    );
    act(() => instructor.result.current.clearAll());
    expect(votes.size).toBe(0);
  });
});

describe("useQABoard role guard", () => {
  it("student markAnswered/clearAll are no-ops", () => {
    const doc = new Y.Doc();
    const student = renderHook(() => useQABoard(makeHandle("stud", doc), "student"));
    act(() => student.result.current.postQuestion("Why?", "Stu"));
    const questions = doc.getMap("qa-board-questions");
    expect(questions.size).toBe(1);
    const id = [...questions.keys()][0]!;

    act(() => student.result.current.markAnswered(id, true));
    expect((questions.get(id) as { answered: boolean }).answered).toBe(false);

    act(() => student.result.current.clearAll());
    expect(questions.size).toBe(1);

    const instructor = renderHook(() =>
      useQABoard(makeHandle("instr", doc), "instructor"),
    );
    act(() => instructor.result.current.markAnswered(id, true));
    expect((questions.get(id) as { answered: boolean }).answered).toBe(true);
    act(() => instructor.result.current.clearAll());
    expect(questions.size).toBe(0);
  });
});

describe("useConfidenceMeter role guard", () => {
  it("student clearAll is a no-op", () => {
    const doc = new Y.Doc();
    const ratings = doc.getMap<number>("confidence-meter-ratings");
    ratings.set("someone", 70);
    const student = renderHook(() =>
      useConfidenceMeter(makeHandle("stud", doc), "student"),
    );
    act(() => student.result.current.clearAll());
    expect(ratings.size).toBe(1);
  });
});

describe("useWordCloud", () => {
  it("student clearAll is a no-op; instructor clearAll clears", () => {
    const doc = new Y.Doc();
    const student = renderHook(() =>
      useWordCloud(makeHandle("stud", doc), false, "student"),
    );
    act(() => student.result.current.submit("aloha"));
    const root = doc.getMap("word-cloud-submissions");
    expect(root.size).toBe(1);

    act(() => student.result.current.clearAll());
    expect(root.size).toBe(1);

    const instructor = renderHook(() =>
      useWordCloud(makeHandle("instr", doc), false, "instructor"),
    );
    act(() => instructor.result.current.clearAll());
    expect(root.size).toBe(0);
  });

  it("caps per-participant submissions at 50", () => {
    const doc = new Y.Doc();
    const student = renderHook(() =>
      useWordCloud(makeHandle("stud", doc), false, "student"),
    );
    act(() => {
      for (let i = 0; i < 60; i += 1) {
        student.result.current.submit(`word-${i}`);
      }
    });
    const arr = doc.getMap<Y.Array<string>>("word-cloud-submissions").get("stud");
    expect(arr?.length).toBe(50);
  });
});

describe("useIsometricChatroom role guard", () => {
  const config = {
    version: "1.0",
    title: "Pixel room",
    room: { width: 8, height: 8 },
    characters: [{ id: "c1", name: "Cat", spriteUrl: "/c1.png" }],
  } as unknown as IsometricChatroomConfig;

  it("student mute/unmute/deleteMessage are no-ops; instructor's work", () => {
    const doc = new Y.Doc();
    const student = renderHook(() =>
      useIsometricChatroom(makeHandle("stud", doc), config, "student"),
    );
    act(() => student.result.current.sendMessage("hello"));
    const messages = doc.getArray("isometric-chatroom-messages");
    expect(messages.length).toBe(1);
    const messageId = (messages.get(0) as { id: string }).id;
    const mutes = doc.getMap<boolean>("isometric-chatroom-muted");

    act(() => student.result.current.muteParticipant("victim"));
    expect(mutes.size).toBe(0);
    act(() => student.result.current.deleteMessage(messageId));
    expect(messages.length).toBe(1);

    const instructor = renderHook(() =>
      useIsometricChatroom(makeHandle("instr", doc), config, "instructor"),
    );
    act(() => instructor.result.current.muteParticipant("victim"));
    expect(mutes.get("victim")).toBe(true);
    act(() => instructor.result.current.unmuteParticipant("victim"));
    expect(mutes.size).toBe(0);
    act(() => instructor.result.current.deleteMessage(messageId));
    expect(messages.length).toBe(0);
  });
});
