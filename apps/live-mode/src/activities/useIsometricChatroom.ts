import { useEffect, useState, useCallback } from "react";
import type { LiveRoomHandle } from "@kukui/live";
import type { IsometricChatroomConfig } from "@kukui/schemas";
import * as Y from "yjs";

/**
 * Y.js binding for the Isometric Chatroom.
 *
 * Manages:
 *   - Avatar state (position, character, direction) per participant
 *   - Chat messages (Y.Array)
 *   - Emoji reactions to messages (Y.Map)
 *   - Instructor moderation state (muted participants, pinned question)
 *
 * Each participant's avatar state is stored in a Y.Map keyed by
 * participantId → AvatarState. This gives us O(1) lookup per peer
 * and automatic CRDT merge for position updates.
 *
 * Chat messages are stored in a Y.Array so all peers see the same
 * ordered list. Each message is a plain object (serialized by Y.js).
 *
 * Emoji reactions are stored in a Y.Map keyed by messageId → { emoji, reactors[] }.
 *
 * Scale: at 60 students, avatar state is ~3 KB (60 × 50 bytes),
 * messages are ~10 KB (60 × 170 bytes), reactions are ~2 KB.
 * Total room state for this activity: ~15 KB — well within the
 * ~15 KB budget per activity in the Y.js CRDT.
 */

const AVATAR_KEY = "isometric-chatroom-avatars";
const MESSAGES_KEY = "isometric-chatroom-messages";
const REACTIONS_KEY = "isometric-chatroom-reactions";
const PINNED_KEY = "isometric-chatroom-pinned";
const MUTE_KEY = "isometric-chatroom-muted";
const PINNED_SLOT = "current";
const MESSAGE_CAP = 500;

export interface AvatarState {
  x: number;
  y: number;
  characterId: string;
  direction: "left" | "right";
  isMuted: boolean;
  isMoving: boolean;
  targetX: number | null;
  targetY: number | null;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: number;
  reactions: Array<{ emoji: string; reactors: string[] }>;
}

export interface EmojiReaction {
  emoji: string;
  reactors: string[];
}

export interface PinnedQuestion {
  text: string;
  createdAt: number;
}

export function useIsometricChatroom(
  room: LiveRoomHandle,
  config: IsometricChatroomConfig,
  role: "instructor" | "student",
): {
  /** All avatar states in the room. */
  avatars: Map<string, AvatarState>;
  /** The local participant's avatar state. */
  myAvatar: AvatarState;
  /** Update the local avatar position. */
  setAvatarPosition(x: number, y: number): void;
  /** Set the character the local participant is using. */
  setCharacter(characterId: string): void;
  /** All chat messages in order. */
  messages: ChatMessage[];
  /** Send a new chat message. */
  sendMessage(text: string): void;
  /** Emoji reactions keyed by messageId. */
  reactions: Map<string, EmojiReaction>;
  /** Add an emoji reaction to a message. */
  addReaction(messageId: string, emoji: string): void;
  /** Remove the local participant's emoji reaction from a message. */
  removeReaction(messageId: string): void;
  /** Pinned question (if set by instructor). */
  pinnedQuestion: PinnedQuestion | null;
  /** Pin a question (instructor only). */
  pinQuestion(text: string): void;
  /** Unpin the current question. */
  unpinQuestion(): void;
  /** Muted participant IDs. */
  mutedParticipants: Set<string>;
  /** Mute a participant (instructor only). */
  muteParticipant(id: string): void;
  /** Unmute a participant (instructor only). */
  unmuteParticipant(id: string): void;
  /** Delete a message (instructor only). */
  deleteMessage(messageId: string): void;
} {
  const avatarsMap = room.doc.getMap<AvatarState>(AVATAR_KEY);
  const messagesArray = room.doc.getArray<ChatMessage>(MESSAGES_KEY);
  const reactionsMap = room.doc.getMap<EmojiReaction>(REACTIONS_KEY);
  const pinnedMap = room.doc.getMap<PinnedQuestion | null>(PINNED_KEY);
  const muteMap = room.doc.getMap<boolean>(MUTE_KEY);

  const [avatarSnapshot, setAvatarSnapshot] = useState(() => readAvatars(avatarsMap));
  const [messageSnapshot, setMessageSnapshot] = useState(() => readMessages(messagesArray));
  const [reactionSnapshot, setReactionSnapshot] = useState(() => readReactions(reactionsMap));
  const [pinnedSnapshot, setPinnedSnapshot] = useState(() => pinnedMap.get(PINNED_SLOT) ?? null);
  const [muteSnapshot, setMuteSnapshot] = useState(() => readMutes(muteMap));

  // Subscribe to avatar changes
  useEffect(() => {
    const handler = () => setAvatarSnapshot(readAvatars(avatarsMap));
    avatarsMap.observe(handler);
    return () => avatarsMap.unobserve(handler);
  }, [avatarsMap]);

  // Subscribe to message changes
  useEffect(() => {
    const handler = () => setMessageSnapshot(readMessages(messagesArray));
    messagesArray.observe(handler);
    return () => messagesArray.unobserve(handler);
  }, [messagesArray]);

  // Subscribe to reaction changes
  useEffect(() => {
    const handler = () => setReactionSnapshot(readReactions(reactionsMap));
    reactionsMap.observe(handler);
    return () => reactionsMap.unobserve(handler);
  }, [reactionsMap]);

  // Subscribe to pinned question changes
  useEffect(() => {
    const handler = () => setPinnedSnapshot(pinnedMap.get(PINNED_SLOT) ?? null);
    pinnedMap.observe(handler);
    return () => pinnedMap.unobserve(handler);
  }, [pinnedMap]);

  // Subscribe to mute changes
  useEffect(() => {
    const handler = () => setMuteSnapshot(readMutes(muteMap));
    muteMap.observe(handler);
    return () => muteMap.unobserve(handler);
  }, [muteMap]);

  const roomWidth = config.room.width ?? 12;
  const roomHeight = config.room.height ?? 12;

  // Initialize local avatar on mount if not present. Distribute spawns
  // via a hash of the participantId so peers don't stack on the centre tile.
  useEffect(() => {
    if (!avatarsMap.has(room.participantId)) {
      const spawn = spawnPosition(room.participantId, roomWidth, roomHeight);
      room.doc.transact(() => {
        avatarsMap.set(room.participantId, {
          x: spawn.x,
          y: spawn.y,
          characterId: config.characters[0]?.id ?? "",
          direction: "right",
          isMuted: false,
          isMoving: false,
          targetX: null,
          targetY: null,
        });
      });
    }
  }, [avatarsMap, room.participantId, roomWidth, roomHeight, config.characters]);

  const fallbackSpawn = spawnPosition(room.participantId, roomWidth, roomHeight);
  const myAvatar: AvatarState = avatarSnapshot.avatars.get(room.participantId) ?? {
    x: fallbackSpawn.x,
    y: fallbackSpawn.y,
    characterId: config.characters[0]?.id ?? "",
    direction: "right",
    isMuted: false,
    isMoving: false,
    targetX: null,
    targetY: null,
  };

  const setAvatarPosition = useCallback(
    (x: number, y: number) => {
      room.doc.transact(() => {
        const current = avatarsMap.get(room.participantId);
        if (!current) return;
        const clampedX = Math.max(0, Math.min(roomWidth - 1, x));
        const clampedY = Math.max(0, Math.min(roomHeight - 1, y));
        avatarsMap.set(room.participantId, {
          ...current,
          x: clampedX,
          y: clampedY,
          targetX: clampedX,
          targetY: clampedY,
          isMoving: true,
          direction: clampedX > current.x ? "right" : "left",
        });
      });
    },
    [avatarsMap, room.participantId, roomWidth, roomHeight],
  );

  const setCharacter = useCallback(
    (characterId: string) => {
      room.doc.transact(() => {
        const current = avatarsMap.get(room.participantId);
        if (!current) return;
        avatarsMap.set(room.participantId, { ...current, characterId });
      });
    },
    [avatarsMap, room.participantId],
  );

  const sendMessage = useCallback(
    (text: string) => {
      // Soft mute-self check: don't write to the array if the local
      // participant is muted. The input is also disabled UI-side, but
      // a stale-state click race could otherwise slip through.
      if (muteMap.get(room.participantId)) return;
      const message: ChatMessage = {
        id: nanoid(),
        authorId: room.participantId,
        authorName: room.presence().get(room.participantId)?.name ?? "Anonymous",
        text,
        timestamp: Date.now(),
        reactions: [],
      };
      room.doc.transact(() => {
        messagesArray.push([message]);
        // Cap the log so an hour-long session doesn't grow unboundedly.
        const overflow = messagesArray.length - MESSAGE_CAP;
        if (overflow > 0) messagesArray.delete(0, overflow);
      });
    },
    [messagesArray, muteMap, room],
  );

  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      room.doc.transact(() => {
        const existing = reactionsMap.get(messageId);
        if (existing) {
          if (existing.reactors.includes(room.participantId)) return;
          reactionsMap.set(messageId, {
            ...existing,
            reactors: [...existing.reactors, room.participantId],
          });
        } else {
          reactionsMap.set(messageId, { emoji, reactors: [room.participantId] });
        }
      });
    },
    [reactionsMap, room.participantId],
  );

  const removeReaction = useCallback(
    (messageId: string) => {
      room.doc.transact(() => {
        const existing = reactionsMap.get(messageId);
        if (!existing) return;
        const reactors = existing.reactors.filter((r) => r !== room.participantId);
        if (reactors.length === 0) {
          reactionsMap.delete(messageId);
        } else {
          reactionsMap.set(messageId, { ...existing, reactors });
        }
      });
    },
    [reactionsMap, room],
  );

  const pinQuestion = useCallback(
    (text: string) => {
      room.doc.transact(() => {
        pinnedMap.set(PINNED_SLOT, { text, createdAt: Date.now() });
      });
    },
    [pinnedMap, room],
  );

  const unpinQuestion = useCallback(() => {
    room.doc.transact(() => {
      pinnedMap.delete(PINNED_SLOT);
    });
  }, [pinnedMap, room]);

  // Moderation mutators below are instructor-only local speed-bumps:
  // integrity is advisory in P2P mode — every client holds the shared doc,
  // so a modified client can still write.
  const muteParticipant = useCallback(
    (id: string) => {
      if (role !== "instructor") return;
      room.doc.transact(() => {
        muteMap.set(id, true);
      });
    },
    [muteMap, role],
  );

  const unmuteParticipant = useCallback(
    (id: string) => {
      if (role !== "instructor") return;
      room.doc.transact(() => {
        muteMap.delete(id);
      });
    },
    [muteMap, role],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      if (role !== "instructor") return;
      room.doc.transact(() => {
        const idx = findMessageIndex(messagesArray, messageId);
        if (idx >= 0) {
          messagesArray.delete(idx, 1);
        }
      });
    },
    [messagesArray, role],
  );

  return {
    avatars: avatarSnapshot.avatars,
    myAvatar,
    setAvatarPosition,
    setCharacter,
    messages: messageSnapshot,
    sendMessage,
    reactions: reactionSnapshot,
    addReaction,
    removeReaction,
    pinnedQuestion: pinnedSnapshot,
    pinQuestion,
    unpinQuestion,
    mutedParticipants: muteSnapshot,
    muteParticipant,
    unmuteParticipant,
    deleteMessage,
  };
}

function readAvatars(avatarsMap: Y.Map<AvatarState>): { avatars: Map<string, AvatarState> } {
  const out = new Map<string, AvatarState>();
  avatarsMap.forEach((value, key) => {
    out.set(key, { ...value });
  });
  return { avatars: out };
}

function readMessages(messagesArray: Y.Array<ChatMessage>): ChatMessage[] {
  return messagesArray.toArray().map((msg) => ({ ...msg }));
}

function findMessageIndex(
  messagesArray: Y.Array<ChatMessage>,
  messageId: string,
): number {
  const arr = messagesArray.toArray();
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]!.id === messageId) return i;
  }
  return -1;
}

function readReactions(reactionsMap: Y.Map<EmojiReaction>): Map<string, EmojiReaction> {
  const out = new Map<string, EmojiReaction>();
  reactionsMap.forEach((value, key) => {
    out.set(key, { ...value, reactors: [...value.reactors] });
  });
  return out;
}

function readMutes(muteMap: Y.Map<boolean>): Set<string> {
  const out = new Set<string>();
  muteMap.forEach((value, key) => {
    if (value) out.add(key);
  });
  return out;
}

/**
 * Generate a short unique id for messages.
 * Uses crypto.getRandomValues for uniqueness within the room.
 */
function nanoid(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

/**
 * Deterministic spawn position for a peer. Avoids the stack-on-centre
 * default and gives each participantId a stable starting tile across
 * reconnects.
 */
function spawnPosition(
  participantId: string,
  roomWidth: number,
  roomHeight: number,
): { x: number; y: number } {
  let hash = 0;
  for (let i = 0; i < participantId.length; i++) {
    hash = (hash * 31 + participantId.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash);
  // Inset by 1 so spawns avoid the absolute edges.
  const usableW = Math.max(1, roomWidth - 2);
  const usableH = Math.max(1, roomHeight - 2);
  return { x: 1 + (h % usableW), y: 1 + (Math.floor(h / usableW) % usableH) };
}
