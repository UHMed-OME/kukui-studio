# Spec: Isometric Chatroom — Kukui Live Activity

> **Date**: 2026-05-14
> **Status**: Draft
> **Milestone**: M4 (Live activity catalog)
> **Tracks**: Schema, Studio authoring, Live runtime, Engine bundle

---

## 1. Overview

An **isometric chatroom** is a synchronous Kukui Live activity where students join as pixel-art avatars in a shared 2D isometric room. Students see each other moving in real-time via WebRTC + Y.js, can type messages that appear as speech bubbles above their avatars, react with emoji, and follow the instructor through the standard phase lifecycle (lobby → question → reveal → discussion → ended).

This is not a replacement for existing live activities (Straw Poll, Quick Quiz, etc.) but a complementary one: it provides an **open-ended communication space** with instructor moderation, designed for small-to-medium class sizes (10–60 students) where the instructor wants students to discuss a topic while maintaining classroom structure.

### 1.1 What it is

- A shared isometric room rendered as a canvas (2D canvas, not WebGL)
- Pixel-art character sprites that walk to positions using animation frames
- Real-time chat with speech bubbles floating above heads
- Emoji reaction bar (students pick from a curated set)
- Instructor controls: mute chat, close lobby, pin a question, moderate

### 1.2 What it is not

- Not a free-for-all chat room — the instructor drives structure
- Not a graded activity — no SCORM score posting (engagement-only, like existing Live activities)
- Not a 3D environment — uses a lightweight 2D isometric renderer
- Not persistent — room state lives only in the Y.js CRDT while peers are connected

---

## 2. Architecture

### 2.1 Position in the Kukui Live stack

```
┌─────────────────────────────────────────────┐
│  Kukui Studio (authoring)                   │
│  - Pick "Isometric Chatroom" activity kind  │
│  - Configure room layout, characters,       │
│    rules, emoji set                         │
│  - Export JSON config                       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Kukui Live app (apps/live-mode/)           │
│  - Join room via Trystero + Y.js            │
│  - Load activity config from ?config=       │
│  - Dispatch to IsometricChatroomLive        │
│    (InstructorView + StudentView)           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  @kukui/live (packages/live/)               │
│  - joinLiveRoom(), deriveRoomCode()         │
│  - RoomStateController (phase, payload)     │
│  - Presence layer (Y.Map of participantId   │
│    → {name, role, joinedAt})               │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Y.js CRDT + Trystero P2P mesh              │
│  - Y.Map<participantId, AvatarState>       │
│  - Y.Array<Message>                        │
│  - Y.Map<emojiReactions>                    │
│  - Y.Map<roomState>                         │
└─────────────────────────────────────────────┘
```

### 2.2 New files to create

| File | Package | Purpose |
|------|---------|---------|
| `packages/schemas/src/isometric-chatroom.ts` | schemas | Zod config schema |
| `packages/schemas/src/index.ts` (edit) | schemas | Export schema + add to SchemaRegistry |
| `packages/core/src/types.ts` (edit) | core | Add to BuiltActivityKind union |
| `packages/core/src/planned.ts` (edit) | core | Add to PLANNED_ACTIVITY_KINDS |
| `apps/live-mode/src/activities/IsometricChatroomLive.tsx` | live-mode | Instructor + Student views |
| `apps/live-mode/src/activities/IsometricChatroomLive.css` | live-mode | Styles |
| `apps/live-mode/src/activities/useIsometricChatroom.ts` | live-mode | Y.js binding hook |
| `apps/live-mode/src/activities/IsometricRoom.tsx` | live-mode | 2D isometric canvas renderer |
| `apps/live-mode/src/activities/isometric-sprites.ts` | live-mode | Sprite sheet generation + animation |
| `apps/studio-app/src/starters.ts` (edit) | studio-app | Starter config for isometric-chatroom |
| `apps/studio-app/src/uiSchemas.ts` (edit) | studio-app | uiSchema for the activity |
| `apps/engine-web/isometric-chatroom.html` | engine-web | Engine HTML entry |
| `packages/core/src/components/isometric-chatroom/` | core | (Phase 2) Engine bundle component |
| `packaging/pack-scorm.js` (edit) | packaging | Add to PHASE_1_ACTIVITIES |

### 2.3 Files to edit (LiveHost dispatch)

| File | Change |
|------|--------|
| `apps/live-mode/src/LiveHost.tsx` | Add `isometric-chatroom` to SchemaRegistry imports + dispatch branch |
| `apps/live-mode/src/App.tsx` | Add to `LIVE_ACTIVITIES` array + `LIVE_AUTO_LOAD_KINDS` |

---

## 3. Schema Design

### 3.1 Config object shape

```typescript
interface IsometricChatroomConfig {
  version: "1.0";
  title: string;                          // Displayed in the room header
  author?: string;                         // Author credit line
  prompt?: string;                         // Opening message shown in lobby
  room: RoomConfig;                        // Room layout + appearance
  characters: CharacterConfig[];           // Available avatar options
  rules: RulesConfig;                      // Chat rules + constraints
  emoji: EmojiConfig;                      // Available emoji set
  appearance: Appearance;                  // Light/dark theme
  live: LiveConfig;                        // joinKey, adminKey, signaling
}
```

### 3.2 RoomConfig

```typescript
interface RoomConfig {
  /** Room name displayed in the header. */
  name: string;
  /** Background theme: classroom, library, cafe, lounge, outdoor, custom. */
  theme: "classroom" | "library" | "cafe" | "lounge" | "outdoor" | "custom";
  /** Custom background image URL (optional, overrides theme). */
  backgroundImage?: string;
  /** Alt text for the background (required if backgroundImage set). */
  backgroundAlt?: string;
  /**
   * Room dimensions in tiles (isometric grid).
   * Default: 12 × 12. Min: 8 × 8. Max: 20 × 20.
   * Larger rooms = more walking space but characters are smaller on screen.
   */
  width?: number;
  height?: number;
  /**
   * Seeded furniture/props placement. Same seed = same layout on resume.
   * "reshuffle" regenerates from the seed.
   */
  seed?: string;
}
```

### 3.3 CharacterConfig

```typescript
interface CharacterConfig {
  /** Unique id for this character option. */
  id: string;
  /** Display name shown to the learner when selecting. */
  label: string;
  /**
   * Sprite sheet data. Each character is a 32×48 pixel sprite
   * (2×3 pixel art per frame, 4 frames for walking).
   * Stored as base64 data URL or external URL.
   */
  sprite: string;
  /** Color palette override for the sprite (optional). */
  palette?: string[];
  /** Whether this character is available to students. */
  availableToStudents: boolean;
}
```

### 3.4 RulesConfig

```typescript
interface RulesConfig {
  /**
   * Whether students must read the rules before entering.
   * Default: true.
   */
  requireAcknowledge: boolean;
  /**
   * Chat rules displayed in the lobby. Each rule is a line.
   * Min 1, max 10 rules.
   */
  rules: string[];
  /**
   * Maximum message length in characters.
   * Default: 280. Min: 50. Max: 1000.
   */
  maxMessageLength: number;
  /**
   * How long messages persist above the avatar before fading.
   * Default: 8000ms. Min: 3000. Max: 30000.
   */
  messageDisplayDuration: number;
  /**
   * Whether students can type freely or only during certain phases.
   * "free" = always, "question" = only during question phase,
   * "discussion" = only during discussion phase.
   */
  chatMode: "free" | "question" | "discussion";
  /**
   * Whether the instructor can close the lobby and start the activity.
   * Default: true.
   */
  allowLobbyClose: boolean;
  /**
   * Whether the instructor can mute/unmute individual students.
   * Default: true.
   */
  allowIndividualMute: boolean;
  /**
   * Whether the instructor can delete messages.
   * Default: true.
   */
  allowMessageDeletion: boolean;
  /**
   * Whether students can see each other's names during chat.
   * Default: true.
   */
  showNamesInChat: boolean;
}
```

### 3.5 EmojiConfig

```typescript
interface EmojiConfig {
  /**
   * Preset emoji sets. Students get the full set; the author
   * can choose which preset to use.
   * "standard" = 24 common emojis
   * "academic" = 20 study/reaction emojis
   * "minimal" = 12 basic reaction emojis
   * "custom" = author defines the set
   */
  preset: "standard" | "academic" | "minimal" | "custom";
  /**
   * Custom emoji set (only used when preset = "custom").
   * Each entry is a short emoji name + the emoji character.
   * Min 4, max 24 entries.
   */
  custom?: { name: string; char: string }[];
}
```

### 3.6 Zod Schema (draft)

```typescript
const versionRe = /^\d+\.\d+(\.\d+)?$/;

export const IsometricChatroomConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1).max(120),
    author: z.string().optional(),
    prompt: z.string().optional(),
    room: z
      .object({
        name: z.string().min(1).max(80),
        theme: z.enum(["classroom", "library", "cafe", "lounge", "outdoor", "custom"]),
        backgroundImage: z.string().url().optional(),
        backgroundAlt: z.string().optional(),
        width: z.number().int().min(8).max(20).optional(),
        height: z.number().int().min(8).max(20).optional(),
        seed: z.string().optional(),
      })
      .strict(),
    characters: z
      .array(
        z
          .object({
            id: z.string().min(1).max(32),
            label: z.string().min(1).max(40),
            sprite: z.string().min(1), // data URL or external URL
            palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
            availableToStudents: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(12)
      .refine((arr) => new Set(arr.map((c) => c.id)).size === arr.length, {
        message: "character ids must be unique",
      }),
    rules: z
      .object({
        requireAcknowledge: z.boolean().optional(),
        rules: z.array(z.string().min(1).max(200)).min(1).max(10),
        maxMessageLength: z.number().int().min(50).max(1000).optional(),
        messageDisplayDuration: z.number().int().min(3000).max(30000).optional(),
        chatMode: z.enum(["free", "question", "discussion"]).optional(),
        allowLobbyClose: z.boolean().optional(),
        allowIndividualMute: z.boolean().optional(),
        allowMessageDeletion: z.boolean().optional(),
        showNamesInChat: z.boolean().optional(),
      })
      .strict()
      .optional(),
    emoji: z
      .object({
        preset: z.enum(["standard", "academic", "minimal", "custom"]),
        custom: z
          .array(
            z.object({
              name: z.string().min(1).max(32),
              char: z.string().min(1).max(4), // emoji chars are 1-4 UTF-16 code units
            }),
          )
          .min(4)
          .max(24)
          .optional(),
      })
      .strict()
      .optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
    live: z
      .object({
        joinKey: z.string().min(4).max(64).optional(),
        adminKey: z.string().min(4).max(64).optional(),
        signaling: z.enum(["nostr", "mqtt"]).optional(),
        relayUrls: z.array(z.string().url()).max(8).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type IsometricChatroomConfig = z.infer<typeof IsometricChatroomConfigSchema>;
```

---

## 4. Pixel Character System

### 4.1 Sprite Design Specs

Each character sprite follows a strict pixel art format:

| Property | Value |
|----------|-------|
| Frame size | 16×24 pixels (each frame) |
| Sheet layout | 4 frames × 1 row (walk cycle: idle, step-left, step-right, step-left) |
| Total sheet | 64×24 pixels |
| Color depth | 8-bit palette per character |
| Animation speed | 150ms per frame (walking), 800ms loop (idle bounce) |

### 4.2 Sprite Generation Strategy

**Approach: Procedural sprite generation at build time.**

Rather than shipping static sprite sheets, the Studio authoring tool will include a **character editor** that lets instructors:

1. Pick from a set of base body templates (human, student, teacher, robot, animal)
2. Customize colors via palette swatches
3. Choose hairstyle/accessories from a grid of pixel art options
4. Preview the sprite in all 4 walk-cycle frames

The generated sprite data is stored as a **compact hex string** in the config (not a base64 data URL) to keep the JSON payload small. Each character occupies ~200 bytes in the config.

### 4.3 Character Templates (included by default)

Six base templates, each with 4 color variations:

| Template | Description |
|----------|-------------|
| `student-m` | Male student silhouette |
| `student-f` | Female student silhouette |
| `teacher-m` | Male teacher silhouette |
| `teacher-f` | Female teacher silhouette |
| `robot` | Friendly robot character |
| `animal` | Animal companion (dog/cat) |

Each template has 4 palette options:
- `default` — standard skin/clothing colors
- `warm` — warm-toned palette
- `cool` — cool-toned palette
- `kukui` — branded kukui-brown palette

### 4.4 Animation System

Walking animation uses a **frame-based sprite renderer** on the 2D canvas:

```typescript
// Each frame is a 16×24 grid of color indices
type SpriteFrame = Uint8Array; // 16 × 24 = 384 bytes, each byte = palette index

interface SpriteSheet {
  frames: SpriteFrame[]; // 4 walk frames
  idleFrame: SpriteFrame; // single idle frame
  palette: string[]; // hex color array
}

interface AnimatedSprite {
  sprite: SpriteSheet;
  frameIndex: number; // 0-3
  frameTimer: number; // ms since last frame change
  isMoving: boolean;
  direction: "left" | "right";
}
```

The animation loop runs at 60fps on the canvas renderer. Walking frames swap every 150ms. When movement stops, the sprite returns to the idle frame with a subtle bounce animation (2-frame loop, 300ms per frame).

### 4.5 Speech Bubble Rendering

When a character sends a message, a speech bubble appears above their head:

```
    ┌─────────────────────┐
    │ Hello everyone!     │
    │                     │
    └──────────┬──────────┘
               ▼
             [sprite]
```

Properties:
- **Position**: Centered above the sprite, offset by sprite height + 8px gap
- **Size**: Auto-width based on text (min 64px, max 200px), fixed height 48px for single line
- **Tail**: Small triangle pointing down to the sprite's head
- **Background**: `Surface` (#FFFFFF) with `Border` (#DAD2C6) 2px border
- **Text**: `TextPrimary` (#1C1E20), Inter Variable, 13px (caption size)
- **Fade**: Starts at opacity 1, fades from 7s to 8s (1s fade-out)
- **Stack**: If multiple characters have bubbles simultaneously, bubbles stack vertically with 8px gap
- **Z-order**: Bubbles render above sprites, below chat log

### 4.6 Emoji Reactions

When a student selects an emoji reaction, it appears as a small floating sprite above the target character's head:

```
    🎉
    ┌───┐
    │Hi!│
    └───┘
     [sprite]
```

Properties:
- **Size**: 16×16 pixels (same as sprite frame)
- **Animation**: Bounces up and down (2px displacement, 400ms cycle) for 2 seconds
- **Fade**: Disappears after 3 seconds with a scale-down animation
- **Multiple reactions**: Stack horizontally above the bubble (max 3 visible, overflow shows count badge)
- **Target**: Can target self or any other character in the room

---

## 5. Isometric Room Rendering

### 5.1 Canvas Rendering Approach

The room is rendered on a `<canvas>` element using the 2D Canvas API (not WebGL). This keeps the engine bundle small (~50KB gzipped for the renderer + sprites) and avoids the complexity of Three.js for a purely 2D experience.

### 5.2 Isometric Projection

```
screenX = (tileX - tileY) * tileWidth / 2 + offsetX
screenY = (tileX + tileY) * tileHeight / 2 + offsetY
```

Tile dimensions: `32×16` pixels (2:1 isometric ratio).

### 5.3 Room Layers (back to front)

1. **Background** — Solid color fill or backgroundImage (stretched/tiled)
2. **Floor grid** — Isometric diamond tiles with subtle border lines
3. **Furniture/props** — Pre-defined tile placements (desks, plants, bookshelves)
4. **Characters** — Sprites sorted by screen Y position (painter's algorithm)
5. **Speech bubbles** — Above sprites, z-ordered by character Y position
6. **Emoji reactions** — Floating above bubbles
7. **Chat log overlay** — Semi-transparent panel at the bottom of the screen

### 5.4 Room Themes

Five built-in themes, each with a complete tile set:

| Theme | Floor | Walls | Props | Vibe |
|-------|-------|-------|-------|------|
| `classroom` | Wood planks | Cream | Whiteboard, bookshelf, desk | Academic |
| `library` | Carpet | Beige | Bookshelves, reading lamp, globe | Quiet study |
| `cafe` | Tile | Light gray | Counter, stools, plant, coffee machine | Casual |
| `lounge` | Carpet | Warm white | Sofa, coffee table, TV, rug | Relaxed |
| `outdoor` | Grass | Sky blue | Trees, bench, flowers, clouds | Open-air |
| `custom` | — | — | — | backgroundImage overrides background |

Each theme is defined as a tile map (width × height array of tile IDs) plus a palette. Tiles are 32×16 pixel isometric sprites.

### 5.5 Camera System

- **Default view**: Centered on the instructor's avatar (or room center if instructor hasn't moved)
- **Student view**: Centered on the student's own avatar
- **Pan**: Click and drag to pan the camera
- **Zoom**: Mouse wheel or pinch to zoom (0.5× to 2×)
- **Bounds**: Camera cannot pan outside the room edges + 50px margin

---

## 6. Chat System

### 6.1 Message Data Structure

```typescript
interface ChatMessage {
  id: string;              // nanoid, unique per message
  authorId: string;        // participantId of the sender
  authorName: string;      // snapshot of name at send time
  text: string;            // message content
  timestamp: number;       // Date.now() at send
  reactions: EmojiReaction[]; // emoji reactions to this message
}

interface EmojiReaction {
  emoji: string;           // emoji character
  reactors: string[];      // participantIds who reacted
}
```

### 6.2 Y.js Storage

Messages are stored in a Y.js Array so all peers see the same ordered list:

```typescript
// In the room's Y.Doc:
// Y.Array<ChatMessage> — keyed by room state payload
// Y.Map<participantId, AvatarState> — per-character state
// Y.Map<string, EmojiReaction> — message reactions
```

### 6.3 AvatarState (per participant)

```typescript
interface AvatarState {
  x: number;           // tile X position (0..room.width)
  y: number;           // tile Y position (0..room.height)
  characterId: string; // which character the student chose
  direction: "left" | "right";
  isMuted: boolean;    // muted by instructor
  isMoving: boolean;
  targetX: number | null; // destination tile (null when idle)
  targetY: number | null;
}
```

The instructor can see all student positions. Students see all other students' positions. Each peer's Y.js update propagates their position to the mesh.

### 6.4 Movement System

Students move by **clicking a tile** in the room:

1. Click on a floor tile → avatar walks to that tile
2. Path is **straight-line** (no collision detection in MVP)
3. Walking speed: 3 tiles per second
4. Walking to adjacent tile: ~333ms; corner-to-corner: ~2.4s
5. While walking, the avatar plays the walk cycle animation
6. When the avatar reaches the target, it stops and shows the idle bounce

### 6.5 Chat UI Layout

The chat panel overlays the bottom 25% of the screen:

```
┌──────────────────────────────────────────────┐
│                                              │
│              Isometric room                   │
│              (canvas)                         │
│                                              │
├──────────────────────────────────────────────┤
│ [📢] Chat (12)                    [🔽]      │  ← Header
│ ───────────────────────────────────────────  │
│ Alice: Welcome to the discussion!            │
│ Bob: Hi everyone!                            │
│ Carol: Ready to start?                       │
│ ───────────────────────────────────────────  │
│ [Type a message...              ] [Send ▶]   │  ← Input
└──────────────────────────────────────────────┘
```

- **Header**: Chat title with participant count, collapse/expand toggle
- **Message list**: Scrollable, shows author name + text (timestamp on hover)
- **Input**: Text input with character count (maxMessageLength), Send button
- **Emoji bar**: Below the input, shows the selected emoji set as a horizontal scrollable row
- **Expand**: Full-screen mode toggles the chat panel to cover the entire screen

### 6.6 Speech Bubble Positioning

Speech bubbles are rendered **above the character's sprite** at their current tile position:

```
bubbleScreenX = characterScreenX
bubbleScreenY = characterScreenY - bubbleHeight - 16
```

When the character moves, the bubble follows them (positioned relative to the sprite, not the tile). The bubble fades in over 100ms when first shown and fades out over 1s at the end of its display duration.

---

## 7. Instructor Controls

### 7.1 Instructor View

The instructor sees everything a student sees, plus an overlay control panel:

| Control | Location | Purpose |
|---------|----------|---------|
| **Close lobby** | Bottom bar | Transitions from "lobby" to "question" phase, tells students the activity is starting |
| **Pin question** | Floating panel | Pins a question at the top of the room for students to see during discussion |
| **Mute all** | Bottom bar | Mutes all students' chat simultaneously |
| **Unmute all** | Bottom bar | Unmutes all students |
| **Individual mute** | Chat panel (per-student) | Mutes a specific student |
| **Delete message** | Chat panel (per-message) | Removes a message from the room |
| **Close room** | Bottom bar | Ends the activity, transitions to "ended" phase |
| **View as student** | Bottom bar | Toggles between instructor view and student view |

### 7.2 Pin Question Feature

The instructor can pin a question to the top of the room. It appears as a banner overlay:

```
┌──────────────────────────────────────────┐
│ 💡 Discussion Question:                  │
│ "What are the key differences between    │
│  formative and summative assessment?"    │
│                          [✕ Close]       │
└──────────────────────────────────────────┘
```

- Always visible above the chat panel
- Students cannot dismiss it (only the instructor can)
- Fades into the background during "reveal" phase
- Disappears during "ended" phase

### 7.3 Moderation Actions

The instructor can perform these moderation actions:

1. **Mute individual student** — Their messages still appear in the chat log but the input is disabled for them
2. **Delete message** — Removes from the Y.js Array; a gray "Message removed by instructor" placeholder remains
3. **Close lobby** — All students see a "The discussion is now open" banner; the lobby phase closes
4. **Reopen lobby** — Students can re-enter the room and see the chat history
5. **End activity** — Transitions to "ended" phase; students see a thank-you message

---

## 8. Studio Authoring Integration

### 8.1 Activity Selection

In Studio's sidebar, "Isometric Chatroom" appears in the **Live** group alongside Straw Poll, Confidence Meter, Word Cloud, Q&A Board, and Quick Quiz.

### 8.2 Editor Tabs

The Studio editor for Isometric Chatroom has these tabs:

1. **Basics** — Title, prompt, room name
2. **Room** — Theme selector, room size slider, seed (regenerate layout button)
3. **Characters** — Character picker (pre-built templates + color swatches), add/remove characters, drag to reorder, preview sprite
4. **Rules** — Rule text inputs, message length slider, chat mode picker, toggle buttons for features
5. **Emoji** — Preset selector, custom emoji editor (if custom preset selected)
6. **Scoring** — Engagement only (no scoring options; always completion-only)

### 8.3 Character Editor

The character editor is a **pixel art preview** with palette controls:

```
┌─────────────┐  ┌──────────────────────────┐
│             │  │ Character:               │
│  [sprite    │  │ Template: [▼ student-m]  │
│   preview]  │  │ Palette:  [🎨][🎨][🎨]   │
│             │  │ Hair:     [▼ none ▼]     │
│  [idle] [walk→] │  │ Eyes:     [▼ happy ▼]  │
│             │  │ Accessories: [▼ none ▼]  │
└─────────────┘  │                          │
                 │ [✓ Save] [✕ Cancel]      │
                 └──────────────────────────┘
```

Characters are stored as **compact hex strings** in the config. Each character takes ~200 bytes. The Studio tool renders a live preview of the sprite using the same renderer that the engine uses.

### 8.4 Room Preview

The Studio editor includes a **mini room preview** that renders a small isometric view of the configured room:

- Shows the selected theme with furniture
- Allows the instructor to click "Regenerate" to reshuffle the seed
- Displays room dimensions (e.g., "12 × 12 tiles")

### 8.5 Starter Config

A starter config is included for new activities:

```json
{
  "version": "1.0",
  "title": "Discussion Chatroom",
  "prompt": "Welcome! Pick a character, explore the room, and join the discussion when the instructor starts.",
  "room": {
    "name": "Classroom",
    "theme": "classroom",
    "width": 12,
    "height": 12,
    "seed": "kukui-default-v1"
  },
  "characters": [
    {
      "id": "student-m-default",
      "label": "Student (default)",
      "sprite": "data:...",
      "availableToStudents": true
    },
    {
      "id": "student-f-default",
      "label": "Student (alt)",
      "sprite": "data:...",
      "availableToStudents": true
    },
    {
      "id": "robot",
      "label": "Robot",
      "sprite": "data:...",
      "availableToStudents": true
    }
  ],
  "rules": {
    "requireAcknowledge": true,
    "rules": [
      "Be respectful to everyone",
      "Stay on topic during the question phase",
      "Use the emoji reactions to respond non-verbally"
    ],
    "maxMessageLength": 280,
    "messageDisplayDuration": 8000,
    "chatMode": "free",
    "allowLobbyClose": true,
    "allowIndividualMute": true,
    "allowMessageDeletion": true,
    "showNamesInChat": true
  },
  "emoji": {
    "preset": "standard"
  },
  "appearance": { "theme": "auto" },
  "live": {
    "joinKey": "",
    "adminKey": "",
    "signaling": "nostr"
  }
}
```

### 8.6 uiSchema

The uiSchema maps Studio form fields to the config structure. Key widgets:

| Field | Widget | Notes |
|-------|--------|-------|
| `room.theme` | Select (enumNames for 6 themes) | Shows theme preview icons |
| `room.width`, `room.height` | Number input (8-20) | Range slider preferred |
| `room.seed` | Text input + "Regenerate" button | Seeds are deterministic |
| `characters` | Array of character cards | Drag reorder, preview sprite |
| `characters[].sprite` | Sprite picker (template + palette) | Not a raw text input |
| `rules.rules` | Array of text inputs | "Add rule" / "Remove rule" buttons |
| `rules.maxMessageLength` | Range slider (50-1000) | Step 10, default 280 |
| `rules.messageDisplayDuration` | Range slider (3000-30000) | Step 500, default 8000 |
| `rules.chatMode` | Radio (free / question / discussion) | |
| `emoji.preset` | Select (standard / academic / minimal / custom) | |
| `emoji.custom` | Array of emoji entries (name + char) | Only shown when preset = custom |

---

## 9. Engine Bundle (Phase 2)

### 9.1 Current State (Phase 1)

In Phase 1, the Isometric Chatroom is a **Live-only** activity. It only runs in the Kukui Live app (`apps/live-mode/`). There is no standalone engine bundle.

### 9.2 Future State (Phase 2)

A standalone engine bundle could be created for the Isometric Chatroom to:

- Run inside a SCORM zip for LMS deployment
- Load the config JSON via `?config=` URL parameter
- Render the isometric room and chat in a self-contained HTML page
- Report engagement (time spent, messages sent) via SCORM suspend_data

This is deferred to Phase 2 because:
1. The Live app is the primary deployment target
2. SCORM packaging for a canvas-based activity adds complexity
3. The activity is engagement-only (no scoring), so SCORM value is minimal

### 9.3 Engine Bundle Size Budget

| Component | Estimated size (gzipped) |
|-----------|--------------------------|
| Canvas renderer | ~30 KB |
| Sprite data (6 templates × 4 palettes) | ~40 KB |
| Room tile sets (5 themes) | ~25 KB |
| Chat UI components | ~15 KB |
| SCORM bridge | ~5 KB |
| **Total** | **~115 KB** |

This is well within the ~400 KB gzipped budget per activity.

---

## 10. Implementation Plan

### Phase 1: Core Live Activity (1 sprint)

1. **Schema + types** — `packages/schemas/src/isometric-chatroom.ts`, export in index, add to SchemaRegistry
2. **Types** — Add `isometric-chatroom` to `BuiltActivityKind` in `packages/core/src/types.ts`
3. **Y.js hook** — `useIsometricChatroom.ts` — AvatarState management, message CRUD, emoji reactions
4. **Isometric renderer** — `IsometricRoom.tsx` — Canvas rendering, tile map, camera, sprite rendering
5. **Sprite system** — `isometric-sprites.ts` — Character sprite generation, animation loop
6. **Student view** — Chat input, room interaction, speech bubbles, emoji reactions
7. **Instructor view** — Control panel, moderation actions, pin question
8. **Live component** — `IsometricChatroomLive.tsx` — Instructor/Student split
9. **Styles** — `IsometricChatroomLive.css` — Chat panel, bubbles, overlays
10. **LiveHost dispatch** — Add to `LiveHost.tsx`
11. **App registration** — Add to `LIVE_ACTIVITIES` + `LIVE_AUTO_LOAD_KINDS`
12. **Starter config** — Add to `starters.ts`
13. **uiSchema** — Add to `uiSchemas.ts`
14. **Sample fixture** — `apps/live-mode/public/samples/isometric-chatroom/basic.json`
15. **Tests** — Y.js hook tests, sprite generation tests, room rendering tests

### Phase 2: Engine Bundle (future)

1. Engine HTML entry + renderer
2. SCORM packaging
3. Config loading via `?config=`
4. Engagement reporting via SCORM

---

## 11. Emoji Presets

### 11.1 Standard (24 emojis)

```
👍 👎 ❤️ 😂 😮 😢 🙌 👏 🎉 💯 ✅ ❌ ⭐ 🔥 💡 🤔 👀 🎯 📝 🎤 🏆 🌟 💪 😊
```

### 11.2 Academic (20 emojis)

```
✅ ❌ ⭐ 💡 🔍 📝 🎯 📊 📚 🔬 🧪 📐 🎓 🏆 💯 👍 ✨ 📌 📎 🔗
```

### 11.3 Minimal (12 emojis)

```
👍 👎 ❤️ 😂 😮 🙌 👏 🎉 💯 ✅ ❌ ⭐
```

---

## 12. Design Token Usage

### 12.1 Colors

| Token | Usage |
|-------|-------|
| `bg` (#FCF8F2) | Room background (when no theme image) |
| `surface` (#FFFFFF) | Chat panel background, speech bubble background |
| `textPrimary` (#1C1E20) | Chat text, bubble text |
| `textSecondary` (#606069) | Chat timestamps, secondary labels |
| `border` (#DAD2C6) | Chat panel borders, bubble borders |
| `borderHover` (#BBAE9A) | Hover states on interactive room elements |
| `primary` (#7B4324) | Instructor control buttons, active elements |
| `success` (#2E6E41) | Correct indicators, "lobby closed" state |
| `error` (#C34132) | Error messages, muted state |
| `tipBg` (#F2F0E8) | Chat panel header background, hint areas |

### 12.2 Spacing

| Token | Usage |
|-------|-------|
| `sm` (8px) | Gap between chat messages |
| `md` (12px) | Chat panel internal padding |
| `lg` (16px) | Chat panel bottom margin, bubble offset from sprite |
| `xl` (20px) | Room tile gap (if visible) |

### 12.3 Typography

| Token | Usage |
|-------|-------|
| `prompt` (16px, 400) | Chat message text |
| `caption` (14px, 400) | Chat timestamps, room dimensions |
| `meta` (13px, 400-600) | Character labels, emoji names |
| `micro` (12px, 600) | Participant count, phase labels |

---

## 13. Accessibility

### 13.1 WCAG 2.2 AA Considerations

| Requirement | Implementation |
|-------------|----------------|
| **Keyboard navigation** | All room tiles are focusable; Tab navigates between interactive elements; Enter activates tiles to walk to |
| **Screen reader** | Chat messages are in a `<ul>` list; each message is an `<li>` with `role="listitem"`; speech bubbles have `aria-label` with author name + text |
| **Reduced motion** | `prefers-reduced-motion` disables sprite animation frames (shows idle frame only) and speech bubble fade animations (instant show/hide) |
| **Color contrast** | Chat text (16px body) meets 4.5:1 on surface background; emoji reactions are paired with text labels |
| **Tap targets** | Room tiles are at minimum 32×32px rendered size (scales with zoom); chat buttons are 44×44px minimum |
| **Name the character** | Each character has a `label` field that appears in the character picker and as a tooltip on hover |

### 13.2 Cognitive Accessibility

- **Predictable movement**: Click a tile → avatar walks there. No hidden mechanics.
- **Message persistence**: Messages stay visible for 8 seconds (configurable) so students can read at their own pace.
- **No time pressure**: No auto-dismiss of chat; no countdown timers.
- **Clear instructor actions**: All instructor controls are labeled with their effect ("Mute all chat", "Close lobby").

---

## 14. Performance Budget

| Metric | Target |
|--------|--------|
| Engine bundle size | ≤ 115 KB gzipped |
| Initial render time | ≤ 500ms on mid-range laptop |
| Character render | ≤ 60fps with 60 characters on screen |
| Chat message latency | ≤ 200ms peer-to-peer (mesh dependent) |
| Memory per participant | ≤ 500 KB (sprite + room state) |
| Total room state at 60 peers | ≤ 30 KB (Y.js CRDT) |

---

## 15. Open Questions

1. **Character customization depth**: How many customization options per template? The spec defines template + palette + accessories. Should we add more (facial expressions, clothing layers)?
2. **Room collision detection**: MVP has no collision. Should characters push each other aside or pass through?
3. **Message history persistence**: Should messages persist across room re-joins within the same session? (Y.js Array survives peer disconnects but not room destroy.)
4. **Voice chat**: Out of scope for MVP but a natural extension. Could use WebRTC data channels for voice packets.
5. **Private messaging**: Should students be able to DM each other? Probably not for MVP (classroom context).
6. **Mobile support**: Isometric room on touch devices needs a virtual joystick or tap-to-walk. Tap-to-walk is in scope; joystick is Phase 2.
7. **Sprite sheet format**: Hex string vs. base64 data URL vs. external URL. Hex is smallest but harder to author. Data URL is easiest to embed but larger. External URL requires hosting.

---

## 16. File Structure Summary

```
kukui-studio/
├── packages/
│   ├── schemas/
│   │   └── src/
│   │       ├── isometric-chatroom.ts          ← NEW: Zod schema
│   │       └── index.ts                       ← EDIT: export + registry
│   └── core/
│       └── src/
│           ├── types.ts                       ← EDIT: BuiltActivityKind
│           └── planned.ts                     ← EDIT: PLANNED_ACTIVITY_KINDS
├── apps/
│   ├── live-mode/
│   │   ├── src/
│   │   │   ├── App.tsx                        ← EDIT: LIVE_ACTIVITIES + LIVE_AUTO_LOAD_KINDS
│   │   │   ├── LiveHost.tsx                   ← EDIT: dispatch branch
│   │   │   └── activities/
│   │   │       ├── IsometricChatroomLive.tsx  ← NEW: Instructor + Student views
│   │   │       ├── IsometricChatroomLive.css  ← NEW: styles
│   │   │       ├── useIsometricChatroom.ts    ← NEW: Y.js hook
│   │   │       ├── IsometricRoom.tsx          ← NEW: canvas renderer
│   │   │       └── isometric-sprites.ts       ← NEW: sprite system
│   │   └── public/
│   │       └── samples/
│   │           └── isometric-chatroom/
│   │               └── basic.json             ← NEW: sample fixture
│   ├── studio-app/
│   │   └── src/
│   │       ├── starters.ts                    ← EDIT: starter config
│   │       └── uiSchemas.ts                   ← EDIT: uiSchema
│   └── engine-web/
│       └── isometric-chatroom.html            ← NEW: engine entry (Phase 2)
└── packaging/
    └── pack-scorm.js                          ← EDIT: PHASE_1_ACTIVITIES
```
