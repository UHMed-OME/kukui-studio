import { useState, useCallback, useEffect, type ComponentType } from "react";
import type { LiveRoomHandle, Presence } from "@kukui/live";
import type { LiveActivityManifest, LiveActivityProps } from "./types.js";
import type { IsometricChatroomConfig } from "@kukui/schemas";
import { usePhase } from "../usePhase.js";
import {
  useIsometricChatroom,
  type AvatarState,
  type ChatMessage,
  type EmojiReaction,
} from "./useIsometricChatroom.js";
import { IsometricRoom } from "./IsometricRoom.js";
import "./IsometricChatroomLive.css";

export type IsometricChatroomLiveProps = {
  room: LiveRoomHandle;
  presence: Map<string, Presence>;
  role: "instructor" | "student";
  config: IsometricChatroomConfig;
  onLeave: () => void;
};

/**
 * Live runtime for the Isometric Chatroom.
 *
 * Instructor view: room canvas + control panel (close lobby, mute, pin question, end).
 * Student view: room canvas + chat panel + character picker + emoji bar.
 *
 * The room canvas renders on a `<canvas>` element with isometric projection.
 * Students click tiles to walk their avatar. Messages appear as speech bubbles.
 */
export function IsometricChatroomLive({
  room,
  presence,
  role,
  config,
  onLeave,
}: IsometricChatroomLiveProps) {
  const { phase, setPhase } = usePhase(room);
  const {
    avatars,
    myAvatar,
    setAvatarPosition,
    setCharacter,
    messages,
    sendMessage,
    reactions,
    addReaction,
    removeReaction,
    pinnedQuestion,
    pinQuestion,
    unpinQuestion,
    mutedParticipants,
    muteParticipant,
    unmuteParticipant,
    deleteMessage,
  } = useIsometricChatroom(room, config);

  const studentCount = [...presence.values()].filter((p) => p.role === "student").length;
  const messageCount = messages.length;
  const isMyMuted = mutedParticipants.has(room.participantId);

  // Chat input state
  const [chatText, setChatText] = useState("");
  const [showChat, setShowChat] = useState(true);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [showEmojiBar, setShowEmojiBar] = useState(true);
  const [armedEmoji, setArmedEmoji] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  // Subscribe to the OS-level reduced-motion preference once (and on change).
  // The original code re-evaluated matchMedia inside JSX on every render and
  // never picked up updates from the user toggling it.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const handleTileClick = useCallback(
    (tileX: number, tileY: number) => setAvatarPosition(tileX, tileY),
    [setAvatarPosition],
  );

  const handleSend = useCallback(() => {
    if (isMyMuted) return;
    const trimmed = chatText.trim();
    if (!trimmed) return;
    const maxLen = config.rules?.maxMessageLength ?? 280;
    if (trimmed.length > maxLen) return;
    sendMessage(trimmed);
    setChatText("");
  }, [chatText, config.rules?.maxMessageLength, isMyMuted, sendMessage]);

  // Tapping an emoji arms it; tapping again unarms.
  const handleEmojiSelect = useCallback((emoji: string) => {
    setArmedEmoji((cur) => (cur === emoji ? null : emoji));
  }, []);

  // Tapping a message while an emoji is armed attaches that emoji to the
  // message. If the local user already reacted, this acts as an undo.
  const handleReactToMessage = useCallback(
    (messageId: string) => {
      if (!armedEmoji) return;
      const existing = reactions.get(messageId);
      if (existing && existing.reactors.includes(room.participantId)) {
        removeReaction(messageId);
      } else {
        addReaction(messageId, armedEmoji);
      }
      setArmedEmoji(null);
    },
    [armedEmoji, reactions, room.participantId, addReaction, removeReaction],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const isOpen = phase === "question" || phase === "discussion";
  const isLobby = phase === "lobby";
  const needsAcknowledge = !!config.rules?.requireAcknowledge && !acknowledged;

  const emojiPreset = config.emoji?.preset ?? "standard";
  const emojiSet = getEmojiSet(emojiPreset, config.emoji?.custom);

  if (role === "instructor") {
    return (
      <InstructorView
        presence={presence}
        config={config}
        phase={phase}
        setPhase={setPhase}
        avatars={avatars}
        messages={messages}
        reactions={reactions}
        myAvatar={myAvatar}
        pinnedQuestion={pinnedQuestion}
        mutedParticipants={mutedParticipants}
        studentCount={studentCount}
        messageCount={messageCount}
        onTileClick={handleTileClick}
        onPinQuestion={pinQuestion}
        onUnpinQuestion={unpinQuestion}
        onMuteParticipant={muteParticipant}
        onUnmuteParticipant={unmuteParticipant}
        onDeleteMessage={deleteMessage}
        onLeave={onLeave}
        prefersReducedMotion={prefersReducedMotion}
      />
    );
  }

  return (
    <StudentView
      config={config}
      phase={phase}
      avatars={avatars}
      myAvatar={myAvatar}
      messages={messages}
      reactions={reactions}
      isMyMuted={isMyMuted}
      isLobby={isLobby}
      isOpen={isOpen}
      showChat={showChat}
      showCharacterPicker={showCharacterPicker}
      showEmojiBar={showEmojiBar}
      chatText={chatText}
      armedEmoji={armedEmoji}
      emojiSet={emojiSet}
      needsAcknowledge={needsAcknowledge}
      messageCount={messageCount}
      onAcknowledge={() => setAcknowledged(true)}
      onTileClick={handleTileClick}
      onChatTextChange={setChatText}
      onSend={handleSend}
      onKeyDown={handleKeyDown}
      onToggleChat={() => setShowChat(!showChat)}
      onToggleCharacterPicker={() => setShowCharacterPicker(!showCharacterPicker)}
      onToggleEmojiBar={() => setShowEmojiBar(!showEmojiBar)}
      onEmojiSelect={handleEmojiSelect}
      onReactToMessage={handleReactToMessage}
      onCharacterSelect={setCharacter}
      onLeave={onLeave}
      prefersReducedMotion={prefersReducedMotion}
    />
  );
}

// ── Instructor View ──────────────────────────────────────────────────────

function InstructorView({
  presence,
  config,
  phase,
  setPhase,
  avatars,
  messages,
  reactions,
  myAvatar,
  pinnedQuestion,
  mutedParticipants,
  studentCount,
  messageCount,
  onTileClick,
  onPinQuestion,
  onUnpinQuestion,
  onMuteParticipant,
  onUnmuteParticipant,
  onDeleteMessage,
  onLeave,
  prefersReducedMotion,
}: {
  presence: Map<string, Presence>;
  config: IsometricChatroomConfig;
  phase: string;
  setPhase: (next: "lobby" | "question" | "reveal" | "discussion" | "ended") => void;
  avatars: Map<string, AvatarState>;
  messages: ChatMessage[];
  reactions: Map<string, EmojiReaction>;
  myAvatar: AvatarState;
  pinnedQuestion: { text: string; createdAt: number } | null;
  mutedParticipants: Set<string>;
  studentCount: number;
  messageCount: number;
  onTileClick: (x: number, y: number) => void;
  onPinQuestion: (text: string) => void;
  onUnpinQuestion: () => void;
  onMuteParticipant: (id: string) => void;
  onUnmuteParticipant: (id: string) => void;
  onDeleteMessage: (id: string) => void;
  onLeave: () => void;
  prefersReducedMotion: boolean;
}) {
  const [pinnedText, setPinnedText] = useState("");
  const displayDuration = config.rules?.messageDisplayDuration ?? 8000;
  const now = Date.now();

  const recentMessages = messages.filter((m) => now - m.timestamp < displayDuration);

  return (
    <div className="isometric-chatroom">
      {/* Room canvas */}
      <div className="isometric-chatroom__room-wrap">
        <IsometricRoom
          config={config}
          avatars={avatars}
          messages={recentMessages}
          reactions={reactions}
          myAvatar={myAvatar}
          onTileClick={onTileClick}
          onTileHover={() => {}}
          prefersReducedMotion={prefersReducedMotion}
        />
        {/* Pinned question overlay */}
        {pinnedQuestion ? (
          <div className="isometric-chatroom__pin-banner" role="status" aria-live="polite">
            <span className="isometric-chatroom__pin-icon">💡</span>
            <p className="isometric-chatroom__pin-text">{pinnedQuestion.text}</p>
            <button
              type="button"
              className="isometric-chatroom__pin-close"
              onClick={onUnpinQuestion}
              aria-label="Close pinned question"
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>

      {/* Instructor control panel */}
      <div className="isometric-chatroom__panel">
        <header className="isometric-chatroom__panel-header">
          <h2 className="isometric-chatroom__panel-title">
            {config.title}
          </h2>
          <p className="isometric-chatroom__panel-subtitle">
            {studentCount} student{studentCount === 1 ? "" : "s"} connected · {messageCount} message{messageCount === 1 ? "" : "s"}
          </p>
        </header>

        {/* Phase controls */}
        <section className="isometric-chatroom__panel-section" aria-label="Session controls">
          <h3 className="isometric-chatroom__panel-heading">Session</h3>
          <div className="isometric-chatroom__phase-btns">
            {phase === "lobby" ? (
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={() => setPhase("question")}
              >
                Start discussion
              </button>
            ) : null}
            {phase === "question" ? (
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={() => setPhase("discussion")}
              >
                Move to discussion
              </button>
            ) : null}
            {phase === "discussion" ? (
              <button
                type="button"
                className="live-btn live-btn--primary"
                onClick={() => setPhase("ended")}
              >
                End activity
              </button>
            ) : null}
          </div>
        </section>

        {/* Pin question */}
        <section className="isometric-chatroom__panel-section" aria-label="Pin a question">
          <h3 className="isometric-chatroom__panel-heading">Pin question</h3>
          <div className="isometric-chatroom__pin-input-row">
            <input
              type="text"
              className="isometric-chatroom__pin-input"
              placeholder="Type a question to pin..."
              value={pinnedText}
              onChange={(e) => setPinnedText(e.target.value)}
              aria-label="Question text to pin"
            />
            <button
              type="button"
              className="live-btn live-btn--ghost"
              onClick={() => {
                if (pinnedText.trim()) onPinQuestion(pinnedText.trim());
              }}
              disabled={!pinnedText.trim()}
              aria-label="Pin the question"
            >
              Pin
            </button>
          </div>
        </section>

        {/* Moderation */}
        <section className="isometric-chatroom__panel-section" aria-label="Moderation">
          <h3 className="isometric-chatroom__panel-heading">Moderation</h3>
          <div className="isometric-chatroom__mod-row">
            <button
              type="button"
              className="live-btn live-btn--ghost"
              onClick={() => {
                [...presence.values()]
                  .filter((p) => p.role === "student")
                  .forEach((p) => onMuteParticipant(p.id));
              }}
            >
              Mute all
            </button>
            <button
              type="button"
              className="live-btn live-btn--ghost"
              onClick={() => {
                [...mutedParticipants].forEach((id) => onUnmuteParticipant(id));
              }}
            >
              Unmute all
            </button>
          </div>
        </section>

        {/* Recent messages */}
        <section className="isometric-chatroom__panel-section" aria-label="Recent messages">
          <h3 className="isometric-chatroom__panel-heading">Recent messages</h3>
          <div className="isometric-chatroom__msg-list">
            {recentMessages.length === 0 ? (
              <p className="isometric-chatroom__msg-empty">No messages yet.</p>
            ) : (
              recentMessages.map((msg) => (
                <div key={msg.id} className="isometric-chatroom__msg-row">
                  <span className="isometric-chatroom__msg-author">
                    {config.rules?.showNamesInChat !== false ? msg.authorName : "Anonymous"}
                  </span>
                  <span className="isometric-chatroom__msg-text">{msg.text}</span>
                  <button
                    type="button"
                    className="isometric-chatroom__msg-delete"
                    onClick={() => onDeleteMessage(msg.id)}
                    aria-label={`Delete message from ${msg.authorName}`}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Leave */}
        <div className="isometric-chatroom__panel-footer">
          <button type="button" className="live-btn live-btn--ghost" onClick={onLeave}>
            Leave room
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Student View ─────────────────────────────────────────────────────────

function StudentView({
  config,
  phase,
  avatars,
  myAvatar,
  messages,
  reactions,
  isMyMuted,
  isLobby,
  isOpen,
  showChat,
  showCharacterPicker,
  showEmojiBar,
  chatText,
  armedEmoji,
  emojiSet,
  needsAcknowledge,
  messageCount,
  onAcknowledge,
  onTileClick,
  onChatTextChange,
  onSend,
  onKeyDown,
  onToggleChat,
  onToggleCharacterPicker,
  onToggleEmojiBar,
  onEmojiSelect,
  onReactToMessage,
  onCharacterSelect,
  onLeave,
  prefersReducedMotion,
}: {
  config: IsometricChatroomConfig;
  phase: string;
  avatars: Map<string, AvatarState>;
  myAvatar: AvatarState;
  messages: ChatMessage[];
  reactions: Map<string, EmojiReaction>;
  isMyMuted: boolean;
  isLobby: boolean;
  isOpen: boolean;
  showChat: boolean;
  showCharacterPicker: boolean;
  showEmojiBar: boolean;
  chatText: string;
  armedEmoji: string | null;
  emojiSet: string[];
  needsAcknowledge: boolean;
  messageCount: number;
  onAcknowledge: () => void;
  onTileClick: (x: number, y: number) => void;
  onChatTextChange: (text: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onToggleChat: () => void;
  onToggleCharacterPicker: () => void;
  onToggleEmojiBar: () => void;
  onEmojiSelect: (emoji: string) => void;
  onReactToMessage: (messageId: string) => void;
  onCharacterSelect: (id: string) => void;
  onLeave: () => void;
  prefersReducedMotion: boolean;
}) {
  const displayDuration = config.rules?.messageDisplayDuration ?? 8000;
  const maxLen = config.rules?.maxMessageLength ?? 280;
  const now = Date.now();
  const recentMessages = messages.filter((m) => now - m.timestamp < displayDuration);

  return (
    <div className="isometric-chatroom">
      {/* Room canvas */}
      <div className="isometric-chatroom__room-wrap">
        <IsometricRoom
          config={config}
          avatars={avatars}
          messages={recentMessages}
          reactions={reactions}
          myAvatar={myAvatar}
          onTileClick={onTileClick}
          onTileHover={() => {}}
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* Lobby overlay — also shown until the student acknowledges rules. */}
        {isLobby || needsAcknowledge ? (
          <div className="isometric-chatroom__lobby-overlay" role="status" aria-live="polite">
            <div className="isometric-chatroom__lobby-card">
              <h2 className="isometric-chatroom__lobby-title">Welcome to {config.room.name}</h2>
              {config.prompt ? (
                <p className="isometric-chatroom__lobby-prompt">{config.prompt}</p>
              ) : null}
              {config.rules?.requireAcknowledge ? (
                <div className="isometric-chatroom__lobby-rules">
                  <h3 className="isometric-chatroom__lobby-rules-title">Room rules</h3>
                  <ol>
                    {config.rules.rules.map((rule, i) => (
                      <li key={i}>{rule}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <p className="isometric-chatroom__lobby-hint">
                Click the floor to walk. Pick a character below.
              </p>
              {needsAcknowledge ? (
                <button
                  type="button"
                  className="live-btn live-btn--primary"
                  onClick={onAcknowledge}
                  aria-label="Acknowledge room rules"
                >
                  I understand — enter the room
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Phase banner */}
        {!isLobby && !isOpen ? (
          <div className="isometric-chatroom__phase-banner" role="status" aria-live="polite">
            <p>
              {phase === "reveal"
                ? "The instructor is revealing answers."
                : phase === "ended"
                  ? "Activity ended. Thanks for participating!"
                  : "Waiting for the instructor..."}
            </p>
          </div>
        ) : null}
      </div>

      {/* Chat panel */}
      {showChat ? (
        <div className="isometric-chatroom__chat-panel">
          <header className="isometric-chatroom__chat-header">
            <button
              type="button"
              className="isometric-chatroom__chat-toggle"
              onClick={onToggleChat}
              aria-label="Collapse chat"
            >
              📢 Chat ({messageCount})
            </button>
          </header>

          {/* Messages */}
          <div className="isometric-chatroom__chat-messages" role="log" aria-label="Chat messages" aria-live="polite">
            {recentMessages.length === 0 ? (
              <p className="isometric-chatroom__chat-empty">
                No messages yet. Start the conversation!
              </p>
            ) : (
              recentMessages.map((msg) => {
                const reaction = reactions.get(msg.id) ?? null;
                const canReact = !!armedEmoji;
                return (
                  <div
                    key={msg.id}
                    className={
                      "isometric-chatroom__chat-msg" +
                      (canReact ? " isometric-chatroom__chat-msg--reactable" : "")
                    }
                    role={canReact ? "button" : undefined}
                    tabIndex={canReact ? 0 : -1}
                    onClick={canReact ? () => onReactToMessage(msg.id) : undefined}
                    onKeyDown={
                      canReact
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onReactToMessage(msg.id);
                            }
                          }
                        : undefined
                    }
                    aria-label={
                      canReact
                        ? `React to ${msg.authorName}'s message with ${armedEmoji}`
                        : undefined
                    }
                  >
                    <span className="isometric-chatroom__chat-msg-author">
                      {config.rules?.showNamesInChat !== false ? msg.authorName : "Anonymous"}
                    </span>
                    <p className="isometric-chatroom__chat-msg-text">{msg.text}</p>
                    {reaction ? (
                      <div className="isometric-chatroom__chat-msg-reactions">
                        <span className="isometric-chatroom__chat-msg-reaction">
                          {reaction.emoji} {reaction.reactors.length}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {/* Emoji bar */}
          {showEmojiBar ? (
            <div className="isometric-chatroom__emoji-bar">
              {armedEmoji ? (
                <span className="isometric-chatroom__emoji-hint" aria-live="polite">
                  Tap a message to react with {armedEmoji}
                </span>
              ) : null}
              {emojiSet.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={[
                    "isometric-chatroom__emoji-btn",
                    armedEmoji === emoji ? "isometric-chatroom__emoji-btn--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onEmojiSelect(emoji)}
                  aria-label={`Arm ${emoji} reaction`}
                  aria-pressed={armedEmoji === emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}

          {/* Input */}
          <div className="isometric-chatroom__chat-input-wrap">
            <input
              type="text"
              className="isometric-chatroom__chat-input"
              placeholder={isMyMuted ? "You are muted" : "Type a message..."}
              value={chatText}
              onChange={(e) => onChatTextChange(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={isMyMuted || !isOpen}
              maxLength={maxLen}
              aria-label="Chat message input"
            />
            <span className="isometric-chatroom__chat-count">
              {chatText.length}/{maxLen}
            </span>
            <button
              type="button"
              className="live-btn live-btn--primary"
              onClick={onSend}
              disabled={!chatText.trim() || isMyMuted || !isOpen}
              aria-label="Send message"
            >
              Send ▶
            </button>
          </div>
        </div>
      ) : null}

      {/* Character picker toggle */}
      <button
        type="button"
        className="isometric-chatroom__char-picker-btn"
        onClick={onToggleCharacterPicker}
        aria-label="Open character picker"
        aria-expanded={showCharacterPicker}
      >
        👤 Characters
      </button>

      {/* Character picker panel */}
      {showCharacterPicker ? (
        <div className="isometric-chatroom__char-picker">
          <header className="isometric-chatroom__char-picker-header">
            <h3 className="isometric-chatroom__char-picker-title">Choose your character</h3>
            <button
              type="button"
              className="isometric-chatroom__char-picker-close"
              onClick={onToggleCharacterPicker}
              aria-label="Close character picker"
            >
              ✕
            </button>
          </header>
          <div className="isometric-chatroom__char-picker-list">
            {config.characters.map((char) => (
              <button
                key={char.id}
                type="button"
                className={[
                  "isometric-chatroom__char-option",
                  myAvatar.characterId === char.id
                    ? "isometric-chatroom__char-option--selected"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onCharacterSelect(char.id)}
                aria-pressed={myAvatar.characterId === char.id}
              >
                <span className="isometric-chatroom__char-label">{char.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Leave button */}
      <button type="button" className="isometric-chatroom__leave-btn" onClick={onLeave}>
        Leave room
      </button>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getEmojiSet(
  preset: "standard" | "academic" | "minimal" | "custom",
  custom?: Array<{ name: string; char: string }>,
): string[] {
  if (preset === "custom" && custom) {
    return custom.map((e) => e.char);
  }
  const presets: Record<string, string[]> = {
    standard: ["👍", "👎", "❤️", "😂", "😮", "😢", "🙌", "👏", "🎉", "💯", "✅", "❌", "⭐", "🔥", "💡", "🤔", "👀", "🎯", "📝", "🎤", "🏆", "🌟", "💪", "😊"],
    academic: ["✅", "❌", "⭐", "💡", "🔍", "📝", "🎯", "📊", "📚", "🔬", "🧪", "📐", "🎓", "🏆", "💯", "👍", "✨", "📌", "📎", "🔗"],
    minimal: ["👍", "👎", "❤️", "😂", "😮", "🙌", "👏", "🎉", "💯", "✅", "❌", "⭐"],
  };
  return (presets[preset] ?? presets.minimal) as string[];
}

export const liveActivity: LiveActivityManifest<"isometric-chatroom"> = {
  kind: "isometric-chatroom",
  Component: IsometricChatroomLive as ComponentType<LiveActivityProps>,
};
