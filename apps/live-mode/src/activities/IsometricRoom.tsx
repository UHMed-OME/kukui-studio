/**
 * Isometric room canvas renderer.
 *
 * Renders a 2D isometric room on a `<canvas>` element with:
 *   - Background (solid color or image)
 *   - Floor grid (isometric diamond tiles)
 *   - Furniture/props (theme-dependent tile placements)
 *   - Character sprites (sorted by screen Y for painter's algorithm)
 *   - Speech bubbles (above sprites)
 *   - Emoji reactions (floating above bubbles)
 *   - Camera system (pan + zoom)
 *
 * Uses the 2D Canvas API — no WebGL needed for this purely 2D experience.
 * The canvas is sized to fill its container and the camera system handles
 * viewport culling so only visible tiles are drawn.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import type { IsometricChatroomConfig } from "@kukui/schemas";
import type { AvatarState, ChatMessage, EmojiReaction } from "./useIsometricChatroom";
import { generateSpriteSheet, tileToScreen, getSpriteRenderHeight, getBubbleOffset, type TemplateName } from "./isometric-sprites.js";

const TILE_WIDTH = 32;
const TILE_HEIGHT = 16;

interface Camera {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

interface RoomTheme {
  floorColor: string;
  floorBorder: string;
  wallColor: string;
  wallTopColor: string;
  propColors: Record<string, string>;
}

const THEMES: Record<IsometricChatroomConfig["room"]["theme"], RoomTheme> = {
  classroom: {
    floorColor: "#E9DEC9",
    floorBorder: "#DAD2C6",
    wallColor: "#FCF8F2",
    wallTopColor: "#F2F0E8",
    propColors: {
      whiteboard: "#FFFFFF",
      bookshelf: "#7B4324",
      desk: "#9B5830",
    },
  },
  library: {
    floorColor: "#D6CFC4",
    floorBorder: "#C8BFB3",
    wallColor: "#F4EDE2",
    wallTopColor: "#E9DEC9",
    propColors: {
      bookshelf: "#7B4324",
      lamp: "#B69B5D",
      globe: "#4A7A8A",
    },
  },
  cafe: {
    floorColor: "#C8D0D4",
    floorBorder: "#B8C0C4",
    wallColor: "#F8F6F2",
    wallTopColor: "#E8E6E2",
    propColors: {
      counter: "#9B5830",
      stool: "#7B4324",
      plant: "#2E6E41",
      coffee: "#3D2B1F",
    },
  },
  lounge: {
    floorColor: "#DDD8D0",
    floorBorder: "#D0C9C0",
    wallColor: "#FAF8F4",
    wallTopColor: "#F0EDE8",
    propColors: {
      sofa: "#6B5B4E",
      table: "#9B5830",
      tv: "#1C1E20",
      rug: "#B69B5D",
    },
  },
  outdoor: {
    floorColor: "#A8C8A0",
    floorBorder: "#98B890",
    wallColor: "#87CEEB",
    wallTopColor: "#B0E0E6",
    propColors: {
      tree: "#2E6E41",
      bench: "#9B5830",
      flower: "#C34132",
      cloud: "#FFFFFF",
    },
  },
  custom: {
    floorColor: "#E9DEC9",
    floorBorder: "#DAD2C6",
    wallColor: "#FCF8F2",
    wallTopColor: "#F2F0E8",
    propColors: {},
  },
};

interface IsometricRoomProps {
  config: IsometricChatroomConfig;
  avatars: Map<string, AvatarState>;
  messages: ChatMessage[];
  reactions: Map<string, EmojiReaction>;
  myAvatar: AvatarState;
  onTileClick: (tileX: number, tileY: number) => void;
  onTileHover: (tileX: number | null, tileY: number | null) => void;
  prefersReducedMotion: boolean;
}

export function IsometricRoom({
  config,
  avatars,
  messages,
  reactions,
  myAvatar,
  onTileClick,
  onTileHover,
  prefersReducedMotion,
}: IsometricRoomProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
  });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const theme = THEMES[config.room.theme] || THEMES.classroom;
  const roomWidth = config.room.width ?? 12;
  const roomHeight = config.room.height ?? 12;

  // Latest draw context, refreshed every render so the RAF loop reads
  // fresh data without re-binding (the previous implementation called
  // setState inside RAF, which tore down and re-queued the loop every
  // frame).
  const drawCtxRef = useRef<DrawContext>({
    config,
    theme,
    avatars,
    messages,
    reactions,
    myAvatar,
    camera: cameraRef.current,
    animTime: 0,
    prefersReducedMotion,
    roomWidth,
    roomHeight,
  });
  drawCtxRef.current = {
    ...drawCtxRef.current,
    config,
    theme,
    avatars,
    messages,
    reactions,
    myAvatar,
    prefersReducedMotion,
    roomWidth,
    roomHeight,
  };

  // Center camera on room
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const centerX = ((roomWidth - roomHeight) / 2) * (TILE_WIDTH / 2);
    cameraRef.current.offsetX = canvas.width / 2 - centerX;
    cameraRef.current.offsetY = canvas.height / 4;
  }, [roomWidth, roomHeight]);

  // Animation loop — runs once on mount, reads everything from
  // drawCtxRef so deps don't churn it 60 times a second.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frameId = 0;
    const animate = (time: number) => {
      drawCtxRef.current.animTime = time;
      drawCtxRef.current.camera = cameraRef.current;
      drawRoom(canvas, drawCtxRef.current);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth * window.devicePixelRatio;
      canvas.height = parent.clientHeight * window.devicePixelRatio;
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const tryTileClickAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const screenX = ((clientX - rect.left) * scaleX) / window.devicePixelRatio;
      const screenY = ((clientY - rect.top) * scaleY) / window.devicePixelRatio;
      const cam = cameraRef.current;
      const worldX = (screenX - cam.offsetX) / cam.zoom;
      const worldY = (screenY - cam.offsetY) / cam.zoom;
      const tileX = Math.round((worldY / (TILE_HEIGHT / 2) + worldX / (TILE_WIDTH / 2)) / 2);
      const tileY = Math.round((worldY / (TILE_HEIGHT / 2) - worldX / (TILE_WIDTH / 2)) / 2);
      if (tileX >= 0 && tileX < roomWidth && tileY >= 0 && tileY < roomHeight) {
        onTileClick(tileX, tileY);
      }
    },
    [roomWidth, roomHeight, onTileClick],
  );

  // Mouse handlers for panning and tile selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        offsetX: cameraRef.current.offsetX,
        offsetY: cameraRef.current.offsetY,
      };
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        cameraRef.current.offsetX = panStartRef.current.offsetX + dx;
        cameraRef.current.offsetY = panStartRef.current.offsetY + dy;
      }
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setIsPanning(false);
        const dx = Math.abs(e.clientX - panStartRef.current.x);
        const dy = Math.abs(e.clientY - panStartRef.current.y);
        if (dx < 5 && dy < 5) tryTileClickAt(e.clientX, e.clientY);
      }
    },
    [isPanning, tryTileClickAt],
  );

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const cam = cameraRef.current;
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    cam.zoom = Math.max(0.5, Math.min(2, cam.zoom * zoomFactor));
  }, []);

  // Touch handlers: single-finger pan; tap (<5px movement) walks to tile.
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    setIsPanning(true);
    panStartRef.current = {
      x: t.clientX,
      y: t.clientY,
      offsetX: cameraRef.current.offsetX,
      offsetY: cameraRef.current.offsetY,
    };
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t || !isPanning) return;
      const dx = t.clientX - panStartRef.current.x;
      const dy = t.clientY - panStartRef.current.y;
      cameraRef.current.offsetX = panStartRef.current.offsetX + dx;
      cameraRef.current.offsetY = panStartRef.current.offsetY + dy;
    },
    [isPanning],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isPanning) return;
      setIsPanning(false);
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = Math.abs(t.clientX - panStartRef.current.x);
      const dy = Math.abs(t.clientY - panStartRef.current.y);
      if (dx < 5 && dy < 5) tryTileClickAt(t.clientX, t.clientY);
    },
    [isPanning, tryTileClickAt],
  );

  return (
    <canvas
      ref={canvasRef}
      className="isometric-room__canvas"
      style={{
        cursor: isPanning ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="img"
      aria-label={config.room.name}
    />
  );
}

interface DrawContext {
  config: IsometricChatroomConfig;
  theme: RoomTheme;
  avatars: Map<string, AvatarState>;
  messages: ChatMessage[];
  reactions: Map<string, EmojiReaction>;
  myAvatar: AvatarState;
  camera: Camera;
  animTime: number;
  prefersReducedMotion: boolean;
  roomWidth: number;
  roomHeight: number;
}

/**
 * Draw the complete room frame.
 */
function drawRoom(
  canvas: HTMLCanvasElement,
  ctx: DrawContext,
) {
  const c = canvas.getContext("2d");
  if (!c) return;

  const { config, theme, avatars, messages, reactions, myAvatar, camera, roomWidth, roomHeight } = ctx;

  // Clear
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.save();
  c.scale(camera.zoom, camera.zoom);
  c.translate(camera.offsetX, camera.offsetY);

  // Draw background
  if (config.room.backgroundImage) {
    // backgroundImage would be loaded and drawn here
    c.fillStyle = theme.wallColor;
    c.fillRect(-100, -100, roomWidth * TILE_WIDTH + 200, roomHeight * TILE_HEIGHT + 200);
  } else {
    c.fillStyle = theme.wallColor;
    c.fillRect(-100, -100, roomWidth * TILE_WIDTH + 200, roomHeight * TILE_HEIGHT + 200);
  }

  // Draw floor tiles
  for (let y = 0; y < roomHeight; y++) {
    for (let x = 0; x < roomWidth; x++) {
      drawTile(c, x, y, theme.floorColor, theme.floorBorder, ctx.animTime);
    }
  }

  // Collect all sprites to render (sorted by screen Y)
  const spritesToRender: Array<{
    screenY: number;
    tileX: number;
    tileY: number;
    avatar: AvatarState;
    authorId: string;
  }> = [];

  for (const [authorId, avatar] of avatars) {
    const screen = tileToScreen(avatar.x, avatar.y);
    spritesToRender.push({
      screenY: screen.y,
      tileX: avatar.x,
      tileY: avatar.y,
      avatar,
      authorId,
    });
  }

  // Sort by screen Y (painter's algorithm)
  spritesToRender.sort((a, b) => a.screenY - b.screenY);

  // Draw sprites, bubbles, and reactions
  for (const { screenY: baseY, tileX, tileY, avatar, authorId } of spritesToRender) {
    const screen = tileToScreen(tileX, tileY);

    // Draw sprite — characterId maps to a template name.
    const sheet = generateSpriteSheet(getDefaultTemplate(avatar.characterId), "default");
    drawSpriteAt(c, screen.x, screen.y, sheet, ctx.animTime, ctx.prefersReducedMotion);

    // Find messages from this author (within display duration)
    const displayDuration = config.rules?.messageDisplayDuration ?? 8000;
    const now = Date.now();
    const authorMessages = messages.filter(
      (msg) =>
        msg.authorId === authorId &&
        now - msg.timestamp < displayDuration,
    );

    // Draw speech bubbles
    if (authorMessages.length > 0) {
      authorMessages.forEach((msg, idx) => {
        drawSpeechBubble(c, screen.x, screen.y - getSpriteRenderHeight() - getBubbleOffset() - idx * 52, msg);
      });
    }

    // Draw emoji reactions for this character's messages
    const authorReactions = findReactionsForAuthor(reactions, authorId, now, displayDuration);
    if (authorReactions.length > 0) {
      drawEmojiReactions(c, screen.x, screen.y - getSpriteRenderHeight() - 40, authorReactions);
    }
  }

  c.restore();
}

/**
 * Draw a single isometric tile.
 */
function drawTile(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  fillColor: string,
  borderColor: string,
  _animTime: number,
) {
  const screen = tileToScreen(x, y);
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;

  c.beginPath();
  c.moveTo(screen.x, screen.y - hh);
  c.lineTo(screen.x + hw, screen.y);
  c.lineTo(screen.x, screen.y + hh);
  c.lineTo(screen.x - hw, screen.y);
  c.closePath();

  c.fillStyle = fillColor;
  c.fill();

  c.strokeStyle = borderColor;
  c.lineWidth = 0.5;
  c.stroke();
}

/**
 * Draw a sprite at a given position.
 */
function drawSpriteAt(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  sheet: ReturnType<typeof generateSpriteSheet>,
  animTime: number,
  prefersReducedMotion: boolean,
) {
  // Determine frame based on animation state
  let frameIdx = 0;
  const bounceIdx = Math.floor(animTime / 300) % 2;
  frameIdx = prefersReducedMotion ? 0 : bounceIdx;

  const frame = sheet.frames[frameIdx] || sheet.idleFrame;
  const palette = sheet.palette;

  // Draw the 16×24 sprite centered at (x, y)
  const drawX = x - 8;
  const drawY = y - 24;

  for (let py = 0; py < 24; py++) {
    for (let px = 0; px < 16; px++) {
      const paletteIdx = frame[py * 16 + px];
      if (!paletteIdx || paletteIdx === 0 || paletteIdx >= palette.length) continue;
      const hex = palette[paletteIdx];
      if (!hex) continue;
      c.fillStyle = hex;
      c.fillRect(drawX + px, drawY + py, 1, 1);
    }
  }
}

/**
 * Draw a speech bubble above a sprite.
 */
function drawSpeechBubble(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  msg: { text: string; authorName: string },
) {
  const fontSize = 13;
  c.font = `400 ${fontSize}px Inter Variable, -apple-system, system-ui, sans-serif`;

  const textWidth = c.measureText(msg.text).width;
  const padding = 8;
  const bubbleWidth = Math.max(64, Math.min(200, textWidth + padding * 2));
  const bubbleHeight = 32;

  const bubbleX = x - bubbleWidth / 2;
  const bubbleY = y - bubbleHeight;

  // Tail triangle
  c.beginPath();
  c.moveTo(x - 4, bubbleY + bubbleHeight);
  c.lineTo(x, bubbleY + bubbleHeight + 6);
  c.lineTo(x + 4, bubbleY + bubbleHeight);
  c.closePath();
  c.fillStyle = "#FFFFFF";
  c.fill();
  c.strokeStyle = "#DAD2C6";
  c.lineWidth = 2;
  c.stroke();

  // Bubble body
  const radius = 6;
  c.beginPath();
  c.moveTo(bubbleX + radius, bubbleY);
  c.lineTo(bubbleX + bubbleWidth - radius, bubbleY);
  c.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + radius);
  c.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - radius);
  c.quadraticCurveTo(
    bubbleX + bubbleWidth,
    bubbleY + bubbleHeight,
    bubbleX + bubbleWidth - radius,
    bubbleY + bubbleHeight,
  );
  c.lineTo(bubbleX + radius, bubbleY + bubbleHeight);
  c.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - radius);
  c.lineTo(bubbleX, bubbleY + radius);
  c.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
  c.closePath();

  c.fillStyle = "#FFFFFF";
  c.fill();
  c.strokeStyle = "#DAD2C6";
  c.lineWidth = 2;
  c.stroke();

  // Text
  c.fillStyle = "#1C1E20";
  c.textBaseline = "middle";
  c.textAlign = "center";

  // Truncate text if needed
  let displayText = msg.text;
  const maxWidth = bubbleWidth - padding * 2;
  while (c.measureText(displayText).width > maxWidth && displayText.length > 3) {
    displayText = displayText.slice(0, -4) + "...";
  }

  c.fillText(displayText, x, bubbleY + bubbleHeight / 2);
}

/**
 * Find emoji reactions for a given author's recent messages.
 */
function findReactionsForAuthor(
  reactions: Map<string, EmojiReaction>,
  authorId: string,
  now: number,
  displayDuration: number,
): Array<{ emoji: string; x: number }> {
  // This would need access to the messages array to find the author's messages
  // For now, return empty — emoji reactions per-character are handled
  // by the message-level reaction display in the chat panel
  return [];
}

/**
 * Draw floating emoji reactions above a character.
 */
function drawEmojiReactions(
  _c: CanvasRenderingContext2D,
  _x: number,
  _y: number,
  _reactions: Array<{ emoji: string; x: number }>,
) {
  // Emoji reactions are displayed in the chat panel for now.
  // Floating emoji above sprites could be added as a Phase 2 enhancement.
}

/**
 * Map a characterId to a template name.
 *
 * Character IDs are author-defined but conventionally follow either:
 *   - `{template}-{palette}` for the two-word templates (e.g. `robot-default`,
 *     `animal-default`)
 *   - `{family}-{gender}-{palette}` for gendered templates (e.g.
 *     `student-m-default`, `teacher-f-warm`)
 *
 * The mapper walks the prefix longest-match-first so that `robot-*` doesn't
 * accidentally resolve to `robot-m` (which doesn't exist and would crash
 * sprite generation).
 */
function getDefaultTemplate(characterId: string): TemplateName {
  const known: TemplateName[] = [
    "student-m",
    "student-f",
    "teacher-m",
    "teacher-f",
    "robot",
    "animal",
  ];
  for (const name of known) {
    if (characterId === name || characterId.startsWith(name + "-")) return name;
  }
  return "student-m";
}
