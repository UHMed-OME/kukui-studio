import { useEffect, useState } from "react";
import * as Y from "yjs";
import type { LiveRoomHandle } from "@kukui/live";

const QUESTIONS_KEY = "qa-board-questions";
const UPVOTES_KEY = "qa-board-upvotes";

export type QAQuestion = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  answered: boolean;
};

export type QABoardSnapshot = {
  questions: QAQuestion[];
  upvotesByQ: Map<string, Set<string>>; // question id → upvoter participantIds
  myQuestionCount: number;
};

/**
 * Y.js binding for Q&A Board.
 *   - `qa-board-questions`: Y.Map<questionId, plain QAQuestion>.
 *     Plain objects are fine here — questions are write-once,
 *     mutated only for the `answered` flag.
 *   - `qa-board-upvotes`: Y.Map<questionId, Y.Map<participantId, true>>.
 *     Y.Map lets us merge concurrent upvotes without dedupe.
 *
 * Total state at 50 questions × ~80 bytes + 50 questions × 300
 * upvoters × ~20 bytes per upvote = ~300 KB worst case at full
 * classroom engagement, which is above our usual envelope. Most
 * sessions land at <50 KB.
 */
export function useQABoard(room: LiveRoomHandle): {
  snapshot: QABoardSnapshot;
  postQuestion(text: string, displayName: string): void;
  toggleUpvote(questionId: string): void;
  markAnswered(questionId: string, answered: boolean): void;
  clearAll(): void;
} {
  const questionsMap = room.doc.getMap<QAQuestion>(QUESTIONS_KEY);
  const upvotesMap = room.doc.getMap<Y.Map<boolean>>(UPVOTES_KEY);
  const [snapshot, setSnapshot] = useState(() => read(questionsMap, upvotesMap, room.participantId));

  useEffect(() => {
    const handler = () =>
      setSnapshot(read(questionsMap, upvotesMap, room.participantId));
    questionsMap.observeDeep(handler);
    upvotesMap.observeDeep(handler);
    return () => {
      questionsMap.unobserveDeep(handler);
      upvotesMap.unobserveDeep(handler);
    };
  }, [questionsMap, upvotesMap, room.participantId]);

  const postQuestion = (text: string, displayName: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    room.doc.transact(() => {
      questionsMap.set(id, {
        id,
        text: trimmed,
        authorId: room.participantId,
        authorName: displayName || "Anonymous",
        createdAt: Date.now(),
        answered: false,
      });
    });
  };

  const toggleUpvote = (questionId: string) => {
    room.doc.transact(() => {
      let votes = upvotesMap.get(questionId);
      if (!votes) {
        votes = new Y.Map<boolean>();
        upvotesMap.set(questionId, votes);
      }
      if (votes.has(room.participantId)) {
        votes.delete(room.participantId);
      } else {
        votes.set(room.participantId, true);
      }
    });
  };

  const markAnswered = (questionId: string, answered: boolean) => {
    room.doc.transact(() => {
      const q = questionsMap.get(questionId);
      if (!q) return;
      questionsMap.set(questionId, { ...q, answered });
    });
  };

  const clearAll = () => {
    room.doc.transact(() => {
      questionsMap.clear();
      upvotesMap.clear();
    });
  };

  return { snapshot, postQuestion, toggleUpvote, markAnswered, clearAll };
}

function read(
  questionsMap: Y.Map<QAQuestion>,
  upvotesMap: Y.Map<Y.Map<boolean>>,
  myId: string,
): QABoardSnapshot {
  const questions: QAQuestion[] = [];
  let myQuestionCount = 0;
  questionsMap.forEach((q: QAQuestion) => {
    if (!q || typeof q !== "object") return;
    questions.push(q);
    if (q.authorId === myId) myQuestionCount += 1;
  });
  const upvotesByQ = new Map<string, Set<string>>();
  upvotesMap.forEach((m: Y.Map<boolean>, qid: string) => {
    if (!m || typeof m.forEach !== "function") return;
    const set = new Set<string>();
    m.forEach((v: boolean, uid: string) => {
      if (v === true) set.add(uid);
    });
    upvotesByQ.set(qid, set);
  });
  return { questions, upvotesByQ, myQuestionCount };
}
