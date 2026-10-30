import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import * as Y from "yjs";
import type { LiveRoomHandle } from "@kukui/live";
import { useLeaderboardQuiz } from "./useLeaderboardQuiz.js";

const room = (doc: Y.Doc, id: string) => ({ doc, participantId: id }) as unknown as LiveRoomHandle;

describe("shuffle setting", () => {
  it("instructor's choice reaches a synced student; students can't change it", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    a.on("update", (u: Uint8Array) => Y.applyUpdate(b, u));
    b.on("update", (u: Uint8Array) => Y.applyUpdate(a, u));
    const teacher = renderHook(() => useLeaderboardQuiz(room(a, "t"), "instructor", true));
    const student = renderHook(() => useLeaderboardQuiz(room(b, "s"), "student", true));
    expect(student.result.current.shuffle).toBe(true);
    act(() => teacher.result.current.setShuffle(false));
    expect(teacher.result.current.shuffle).toBe(false);
    expect(student.result.current.shuffle).toBe(false);
    act(() => student.result.current.setShuffle(true));
    expect(student.result.current.shuffle).toBe(false);
  });

  it("manual pace: the instructor's deck and current question reach students", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    a.on("update", (u: Uint8Array) => Y.applyUpdate(b, u));
    const teacher = renderHook(() => useLeaderboardQuiz(room(a, "t"), "instructor", true));
    const student = renderHook(() => useLeaderboardQuiz(room(b, "s"), "student", true));
    expect(student.result.current.pace).toBe("auto");
    act(() => {
      teacher.result.current.setPace("manual");
      teacher.result.current.startManual([2, 0, 1]);
    });
    act(() => teacher.result.current.setManualIndex(1));
    expect(student.result.current.pace).toBe("manual");
    expect(student.result.current.manual).toEqual({ deck: [2, 0, 1], index: 1 });
    act(() => student.result.current.setManualIndex(2));
    expect(student.result.current.manual.index).toBe(1);
  });

  it("showBoard defaults to true; the instructor can hide it for students only", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    a.on("update", (u: Uint8Array) => Y.applyUpdate(b, u));
    const teacher = renderHook(() => useLeaderboardQuiz(room(a, "t"), "instructor", true));
    const student = renderHook(() => useLeaderboardQuiz(room(b, "s"), "student", true));
    expect(student.result.current.showBoard).toBe(true);
    act(() => teacher.result.current.setShowBoard(false));
    expect(student.result.current.showBoard).toBe(false);
    act(() => student.result.current.setShowBoard(true));
    expect(student.result.current.showBoard).toBe(false);
    act(() => teacher.result.current.setShowBoard(true));
    expect(student.result.current.showBoard).toBe(true);
  });
});
