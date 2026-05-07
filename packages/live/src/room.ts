import * as Y from "yjs";
import type { LivePhase, LiveRoomState } from "./types.js";
import type { LiveRoomHandle } from "./transport.js";

/**
 * Y.js-backed shared state helpers. Every Live activity sits on top of
 * one Y.Doc per room; this module owns the document's top-level shape so
 * activity components can read/write phase + payload without reaching
 * into Y.js primitives directly.
 */

const ROOT_KEY = "__room__";
const PHASE_KEY = "phase";
const QUESTION_KEY = "currentQuestionId";
const PAYLOAD_KEY = "payload";

export function getRoomState<TPayload = unknown>(
  handle: LiveRoomHandle,
): RoomStateController<TPayload> {
  const root = handle.doc.getMap<unknown>(ROOT_KEY);
  return new RoomStateController<TPayload>(handle.doc, root);
}

export class RoomStateController<TPayload> {
  constructor(
    private readonly doc: Y.Doc,
    private readonly root: Y.Map<unknown>,
  ) {}

  getPhase(): LivePhase {
    return (this.root.get(PHASE_KEY) as LivePhase | undefined) ?? "lobby";
  }

  setPhase(phase: LivePhase): void {
    this.doc.transact(() => {
      this.root.set(PHASE_KEY, phase);
    });
  }

  getCurrentQuestionId(): string | null {
    return (this.root.get(QUESTION_KEY) as string | null | undefined) ?? null;
  }

  setCurrentQuestionId(id: string | null): void {
    this.doc.transact(() => {
      this.root.set(QUESTION_KEY, id);
    });
  }

  getPayload(): TPayload | undefined {
    return this.root.get(PAYLOAD_KEY) as TPayload | undefined;
  }

  setPayload(payload: TPayload): void {
    this.doc.transact(() => {
      this.root.set(PAYLOAD_KEY, payload as unknown);
    });
  }

  /** Subscribe to any change on the room state. Returns an unsubscribe fn. */
  subscribe(cb: (snapshot: LiveRoomState<TPayload>) => void): () => void {
    const handler = () => {
      cb({
        activityKind:
          (this.root.get("activityKind") as LiveRoomState["activityKind"]) ?? "multiple-choice",
        phase: this.getPhase(),
        currentQuestionId: this.getCurrentQuestionId(),
        payload: (this.getPayload() ?? ({} as TPayload)) as TPayload,
      });
    };
    this.root.observeDeep(handler);
    handler();
    return () => this.root.unobserveDeep(handler);
  }
}
