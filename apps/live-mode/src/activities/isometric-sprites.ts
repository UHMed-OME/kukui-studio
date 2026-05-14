/**
 * Pixel sprite system for the Isometric Chatroom.
 *
 * Characters are stored in the config as compact sprite data. This module
 * provides:
 *   - Sprite sheet parsing (base64 or external URL)
 *   - Animation frame management (walk cycle + idle bounce)
 *   - Palette application
 *   - Default character template generation
 *
 * Each sprite is a 16×24 pixel grid (384 bytes per frame). The walk cycle
 * has 4 frames: idle, step-left, step-right, step-left (return).
 */

// ── Default character templates ──────────────────────────────────────────
// Six base templates × 4 palettes = 24 sprites.
// Each template is defined as a palette of color indices that map to hex values.

const PALETTES: Record<string, readonly string[]> = {
  default: ["#000000", "#FFFFFF", "#1C1E20", "#606069", "#DAD2C6", "#7B4324", "#9B5830", "#2E6E41"],
  warm: ["#000000", "#FFFFFF", "#3D2B1F", "#8B6F47", "#E9DEC9", "#C34132", "#B69B5D", "#F2F0E8"],
  cool: ["#000000", "#FFFFFF", "#1A3A4A", "#4A7A8A", "#C8D8E0", "#3A6E8C", "#8AB4C8", "#E0F0F8"],
  kukui: ["#000000", "#FFFFFF", "#1C1E20", "#7B4324", "#DAD2C6", "#9B5830", "#E6B693", "#F4EDE2"],
} as const;

export type TemplateName = "student-m" | "student-f" | "teacher-m" | "teacher-f" | "robot" | "animal";
export type PaletteName = "default" | "warm" | "cool" | "kukui";

const TEMPLATES: Record<TemplateName, { id: string; label: string; grid: readonly string[] }> = {
  "student-m": {
    id: "student-m",
    label: "Student (default)",
    grid: [
      ".OOOOO.",
      "OHHHHHO",
      "OHE.EHO",
      "OHHHHHO",
      ".OOOOO.",
      ".CC.CC.",
      "CCCCCCC",
      "CCCCCCC",
      ".CC.CC.",
      ".CC.CC.",
      "CCCCCCC",
      "CCCCCCC",
    ],
  },
  "student-f": {
    id: "student-f",
    label: "Student (alt)",
    grid: [
      ".OOOOO.",
      "OHHHHHO",
      "HHHE.HHO",
      "OHE.EHO",
      "OHHHHHO",
      ".OOOOO.",
      ".CC.CC.",
      "CCCCCCC",
      "CCCCCCC",
      ".CC.CC.",
      ".CC.CC.",
      "CCCCCCC",
    ],
  },
  "teacher-m": {
    id: "teacher-m",
    label: "Teacher",
    grid: [
      ".OOOOO.",
      "OHHHHHO",
      "OHE.EHO",
      "OHHHHHO",
      ".OOOOO.",
      "CCCCCCC",
      "CCCCCCC",
      "CCCCCCC",
      ".CC.CC.",
      ".CC.CC.",
      "CCCCCCC",
      "CCCCCCC",
    ],
  },
  "teacher-f": {
    id: "teacher-f",
    label: "Teacher (alt)",
    grid: [
      ".OOOOO.",
      "OHHHHHO",
      "HHHE.HHO",
      "OHE.EHO",
      "OHHHHHO",
      ".OOOOO.",
      "CCCCCCC",
      "CCCCCCC",
      "CCCCCCC",
      ".CC.CC.",
      ".CC.CC.",
      "CCCCCCC",
    ],
  },
  robot: {
    id: "robot",
    label: "Robot",
    grid: [
      ".OOOOO.",
      "OOOOOOO",
      "OEE.EEO",
      "OOOOOOO",
      "OHHHHHO",
      ".OOOOO.",
      "CCCCCCC",
      "CCCCCCC",
      "CCCCCCC",
      ".CC.CC.",
      ".CC.CC.",
      "CCCCCCC",
    ],
  },
  animal: {
    id: "animal",
    label: "Animal",
    grid: [
      "OO.OOOO",
      "O..OO.O",
      "OHE.EHO",
      "OHHHHHO",
      ".OOOOO.",
      ".CC.CC.",
      "CCCCCCC",
      "CCCCCCC",
      ".CC.CC.",
      ".CC.CC.",
      "CCCCCCC",
      "CCCCCCC",
    ],
  },
} as const;

// ── Sprite frame generation ──────────────────────────────────────────────

/**
 * Generate a single sprite frame from a template grid and palette.
 * Returns a Uint8Array of 384 bytes (16×24 grid of palette indices).
 */
export function generateSpriteFrame(
  template: TemplateName,
  paletteName: PaletteName,
): Uint8Array {
  const templateDef = TEMPLATES[template];
  const palette = (PALETTES[paletteName] ?? PALETTES.default) as readonly string[];
  const frame = new Uint8Array(16 * 24);

  const grid = templateDef.grid;
  const startY = Math.max(0, (12 - grid.length) / 2);

  for (let row = 0; row < grid.length; row++) {
    const y = Math.floor(startY + row);
    if (y < 0 || y >= 24) continue;
    const line = grid[row]!;
    const offsetX = Math.floor((16 - line.length) / 2);
    for (let col = 0; col < line.length; col++) {
      const x = offsetX + col;
      if (x < 0 || x >= 16) continue;
      const ch = line[col];
      if (!ch) continue;
      const idx = y * 16 + x;
      if (ch === ".") {
        frame[idx] = 0; // transparent
      } else {
        const paletteIdx = getCharPaletteIndex(ch);
        frame[idx] = paletteIdx < palette.length ? paletteIdx : 0;
      }
    }
  }

  return frame;
}

/** Map template character codes to palette indices. */
function getCharPaletteIndex(ch: string): number {
  switch (ch) {
    case "O": return 0; // outline
    case "S": return 1; // skin
    case "C": return 2; // clothing
    case "H": return 3; // hair
    case "E": return 4; // eyes
    case "W": return 5; // white (teeth, highlights)
    default: return 0;
  }
}

// ── Sprite sheet ─────────────────────────────────────────────────────────

export interface SpriteSheet {
  frames: Uint8Array[]; // 4 walk frames
  idleFrame: Uint8Array;
  palette: string[];
  template: TemplateName;
  paletteName: PaletteName;
}

/**
 * Generate a full sprite sheet for a character template + palette.
 * The walk cycle has 4 frames: idle, step-left, step-right, step-left.
 */
export function generateSpriteSheet(
  template: TemplateName,
  paletteName: PaletteName,
): SpriteSheet {
  const palette = [...(PALETTES[paletteName] ?? PALETTES.default) as readonly string[]];
  const idleFrame = generateSpriteFrame(template, paletteName);

  // Walk frames: slight offset for each step to simulate walking
  const frames = generateWalkCycle(template, paletteName);

  return { frames, idleFrame, palette, template, paletteName };
}

/**
 * Generate 4 walk cycle frames by offsetting body parts.
 * Frame 0: idle (same as idleFrame)
 * Frame 1: step-left (left leg forward, body shifted)
 * Frame 2: step-right (right leg forward, body shifted)
 * Frame 3: step-left return (same as frame 1, mirrored direction)
 */
// Walk cycle: frame 0 idle, then alternating leg offsets to fake steps.
const WALK_LEG_OFFSETS = [0, 1, -1, 1] as const;

function generateWalkCycle(
  template: TemplateName,
  paletteName: PaletteName,
): Uint8Array[] {
  const base = generateSpriteFrame(template, paletteName);
  const frames: Uint8Array[] = [base.slice()];

  for (let i = 1; i < WALK_LEG_OFFSETS.length; i++) {
    const frame = base.slice();
    const legOffset = WALK_LEG_OFFSETS[i] ?? 0;
    // Shift leg pixels (grid rows 8-11, columns 6-9) by legOffset.
    for (let row = 8; row < 12; row++) {
      for (let col = 6; col <= 9; col++) {
        const pixelIdx = row * 16 + col;
        const targetIdx = row * 16 + (col + legOffset);
        if (targetIdx >= 0 && targetIdx < 384 && base[targetIdx] !== 0) {
          frame[targetIdx] = base[pixelIdx] ?? 0;
          frame[pixelIdx] = 0;
        }
      }
    }
    frames.push(frame);
  }

  return frames;
}

// ── Default characters ───────────────────────────────────────────────────

/**
 * Generate default character data for the starter config.
 * Returns an array of character definitions with inline sprite data.
 */
export function getDefaultCharacters(): Array<{
  id: string;
  label: string;
  sprite: string;
  palette?: string[];
  availableToStudents: boolean;
}> {
  const templates: Array<{ template: TemplateName; label: string }> = [
    { template: "student-m", label: "Student (default)" },
    { template: "student-f", label: "Student (alt)" },
    { template: "robot", label: "Robot" },
  ];

  return templates.map(({ template, label }) => ({
    id: `${template}-default`,
    label,
    sprite: generateSpriteDataURL(template),
    availableToStudents: true,
  }));
}

/**
 * Generate a base64 data URL for a single sprite frame.
 * Creates a minimal PNG from the sprite grid.
 */
function generateSpriteDataURL(template: TemplateName): string {
  const sheet = generateSpriteSheet(template, "default");
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 24;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const imageData = ctx.createImageData(16, 24);
  for (let i = 0; i < sheet.idleFrame.length; i++) {
    const paletteIdx = sheet.idleFrame[i];
    if (!paletteIdx || paletteIdx === 0) continue; // transparent
    const hex = sheet.palette[paletteIdx];
    if (!hex) continue;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const pxIdx = i * 4;
    imageData.data[pxIdx] = r;
    imageData.data[pxIdx + 1] = g;
    imageData.data[pxIdx + 2] = b;
    imageData.data[pxIdx + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

// ── Animation helper ─────────────────────────────────────────────────────

export interface AnimationState {
  frameIndex: number;
  frameTimer: number;
  isMoving: boolean;
  direction: "left" | "right";
}

export const FRAME_DURATION = 150; // ms per walk frame
export const IDLE_BOUNCE_DURATION = 300; // ms per idle bounce frame
export const IDLE_BOUNCE_FRAMES = 2;

/**
 * Update the animation state for a given tick.
 * Returns the new frame index and whether the sprite should show idle.
 */
export function updateAnimation(
  anim: AnimationState,
  dt: number,
): { frameIndex: number; isIdle: boolean } {
  let { frameIndex, frameTimer, isMoving } = anim;
  frameTimer += dt;

  if (isMoving) {
    if (frameTimer >= FRAME_DURATION) {
      frameTimer -= FRAME_DURATION;
      frameIndex = (frameIndex + 1) % 4;
    }
    return { frameIndex, isIdle: false };
  }

  // Idle bounce: alternate between 2 frames
  const bounceIdx = Math.floor(frameTimer / IDLE_BOUNCE_DURATION) % IDLE_BOUNCE_FRAMES;
  return { frameIndex: bounceIdx, isIdle: true };
}

// ── Tile to screen conversion ────────────────────────────────────────────

const TILE_WIDTH = 32; // rendered tile width
const TILE_HEIGHT = 16; // rendered tile height (isometric 2:1 ratio)

/**
 * Convert tile coordinates to screen coordinates (isometric projection).
 */
export function tileToScreen(tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: (tileX - tileY) * (TILE_WIDTH / 2),
    y: (tileX + tileY) * (TILE_HEIGHT / 2),
  };
}

/**
 * Convert screen coordinates to tile coordinates (inverse isometric).
 */
export function screenToTile(screenX: number, screenY: number): { x: number; y: number } {
  const adjX = screenX / (TILE_WIDTH / 2);
  const adjY = screenY / (TILE_HEIGHT / 2);
  return {
    x: Math.round((adjY + adjX) / 2),
    y: Math.round((adjY - adjX) / 2),
  };
}

/**
 * Get the rendered height of a sprite at a given tile position.
 * Used for bubble positioning.
 */
export function getSpriteRenderHeight(): number {
  return 24; // sprite is 24 pixels tall
}

/**
 * Get the bubble offset from the sprite base (pixels above).
 */
export function getBubbleOffset(): number {
  return 16;
}
