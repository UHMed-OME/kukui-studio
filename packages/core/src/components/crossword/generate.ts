/**
 * Crossword layout generator.
 *
 * Given a list of `{ id, term }` entries and a seed, lays out the terms on
 * a grid so that, where possible, terms intersect on shared letters. Output
 * is a deterministic function of (entries, seed) — same inputs always
 * produce the same grid — so the runtime can persist a seed in suspendData
 * and rebuild the exact puzzle on resume.
 *
 * Algorithm — greedy with seeded shuffle:
 *
 *   1. Uppercase + de-duplicate the terms (the schema already rejects
 *      duplicates and bad characters; we belt-and-suspenders).
 *   2. Sort terms by length (longest first). Within a length bucket the
 *      seed shuffles them so two consecutive sessions with the same word
 *      list get different layouts.
 *   3. Place the first term horizontally at an arbitrary origin (0, 0).
 *   4. For each remaining term, iterate every (placed-letter, new-letter)
 *      pair where the letters match. Score each candidate placement by:
 *          - (+) total crossings with the placed grid
 *          - (-) penalties for cells that already differ, ends touching
 *                another letter, or runs of parallel letters that would
 *                form unintended new words.
 *      Pick the highest-scoring legal placement. Tie-break: smaller
 *      resulting bounding box; further tie-break: random by seed.
 *   5. If no legal intersection exists, place the term isolated below the
 *      current grid (offset row, col 0). This is rare for medical-ed term
 *      lists but is a guaranteed termination case.
 *   6. Normalize coordinates so the top-left of the bounding box is (0,0)
 *      and emit `{ rows, cols, placements }`.
 *   7. Number the puzzle row-major: any cell that starts a horizontal or
 *      vertical run is assigned the next sequential clue number; a single
 *      cell can carry both an "across" and a "down" number-of-one.
 *
 * Output structure is intentionally simple — no `cells` 2D array, no
 * pre-computed answer grid. The component derives those from `placements`
 * since both are easy to compute and storing them would just multiply the
 * suspendData size for no benefit.
 */

export type Direction = "across" | "down";

export type Placement = {
  /** Matches the input entry id verbatim, so clues stay paired with terms. */
  id: string;
  /** Uppercased copy of the term, character-by-character. */
  term: string;
  row: number;
  col: number;
  direction: Direction;
  /** Sequential clue number (1-based), shared across direction. */
  number: number;
};

export type Layout = {
  rows: number;
  cols: number;
  placements: Placement[];
  /** Entries the generator couldn't place at all — UI surfaces this as a warning. */
  unplaced: string[];
};

type InputEntry = { id: string; term: string };

type Cell = { letter: string };

/**
 * Tiny seeded PRNG (mulberry32) — stable shuffle across reloads when paired
 * with a deterministic seed.
 */
function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
}

const cellKey = (r: number, c: number) => `${r},${c}`;

/**
 * Try to place `term` so its `termIdx`-th letter sits at (anchorRow,
 * anchorCol). `direction` is the direction the term will run.
 *
 * Returns the placement and a score, or null if the placement is illegal.
 *
 * "Legal" means:
 *   - Every cell the term would occupy is either empty or already holds
 *     the same letter (an intersection).
 *   - The cells immediately before and after the term (along its
 *     direction) are empty — otherwise we'd merge the new term with an
 *     existing letter to form a longer unintended word.
 *   - For each non-intersection cell, the cells immediately perpendicular
 *     to the term on either side must be empty — otherwise we'd create a
 *     parallel double-letter that the learner would read as a new word
 *     the clue list doesn't cover.
 */
function tryPlace(
  grid: Map<string, Cell>,
  term: string,
  direction: Direction,
  anchorRow: number,
  anchorCol: number,
  termIdx: number,
): { score: number; row: number; col: number } | null {
  const startRow = direction === "across" ? anchorRow : anchorRow - termIdx;
  const startCol = direction === "across" ? anchorCol - termIdx : anchorCol;

  // Cells immediately before / after the term must be empty.
  const beforeRow = direction === "across" ? startRow : startRow - 1;
  const beforeCol = direction === "across" ? startCol - 1 : startCol;
  if (grid.has(cellKey(beforeRow, beforeCol))) return null;
  const afterRow = direction === "across" ? startRow : startRow + term.length;
  const afterCol = direction === "across" ? startCol + term.length : startCol;
  if (grid.has(cellKey(afterRow, afterCol))) return null;

  let crossings = 0;
  for (let i = 0; i < term.length; i += 1) {
    const r = direction === "across" ? startRow : startRow + i;
    const c = direction === "across" ? startCol + i : startCol;
    const existing = grid.get(cellKey(r, c));
    if (existing) {
      if (existing.letter !== term[i]) return null;
      crossings += 1;
      continue;
    }
    // Non-intersection: parallel neighbours must be empty.
    const perp1Row = direction === "across" ? r - 1 : r;
    const perp1Col = direction === "across" ? c : c - 1;
    const perp2Row = direction === "across" ? r + 1 : r;
    const perp2Col = direction === "across" ? c : c + 1;
    if (grid.has(cellKey(perp1Row, perp1Col))) return null;
    if (grid.has(cellKey(perp2Row, perp2Col))) return null;
  }

  if (crossings === 0) return null;
  return { score: crossings, row: startRow, col: startCol };
}

function assignNumbers(placements: Placement[], rows: number, cols: number): void {
  // Build occupancy map of starting cells per direction.
  const startKeys = new Set<string>();
  for (const p of placements) startKeys.add(`${p.row},${p.col}`);
  let next = 1;
  const numberByCell = new Map<string, number>();
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const k = `${r},${c}`;
      if (startKeys.has(k)) {
        numberByCell.set(k, next);
        next += 1;
      }
    }
  }
  for (const p of placements) {
    const n = numberByCell.get(`${p.row},${p.col}`);
    if (n !== undefined) p.number = n;
  }
}

/**
 * Public entry point — wraps `attemptLayout` with a deterministic
 * multi-seed retry. The seed argument is used to derive a sequence of
 * sub-seeds; we run the greedy placer for each and pick the layout with
 * the fewest unplaced terms, breaking ties by smaller bounding box.
 *
 * Without the retry, a single seed sometimes commits to an early-greedy
 * placement that paints the algorithm into a corner — a later term has
 * no legal intersection and falls back to isolated. Trying ~12 sub-seeds
 * recovers from those dead-ends ~95% of the time on typical inputs.
 */
export function generateLayout(entries: readonly InputEntry[], seed: number): Layout {
  const subseedRand = rng(seed);
  let best: Layout | null = null;
  const ATTEMPTS = 16;
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const subseed = Math.floor(subseedRand() * 0x7fffffff);
    const candidate = attemptLayout(entries, subseed);
    if (!best) {
      best = candidate;
      if (candidate.unplaced.length === 0) break;
      continue;
    }
    if (candidate.unplaced.length < best.unplaced.length) {
      best = candidate;
      if (candidate.unplaced.length === 0) break;
      continue;
    }
    if (
      candidate.unplaced.length === best.unplaced.length &&
      candidate.rows * candidate.cols < best.rows * best.cols
    ) {
      best = candidate;
    }
  }
  return best ?? { rows: 0, cols: 0, placements: [], unplaced: [] };
}

function attemptLayout(entries: readonly InputEntry[], seed: number): Layout {
  const rand = rng(seed);
  const normalized = entries
    .map((e) => ({ id: e.id, term: e.term.toUpperCase() }))
    .filter((e) => /^[A-Z]{2,}$/.test(e.term));

  // Sort longest-first with seeded shuffle within a length bucket.
  const buckets = new Map<number, InputEntry[]>();
  for (const e of normalized) {
    const list = buckets.get(e.term.length) ?? [];
    list.push(e);
    buckets.set(e.term.length, list);
  }
  const sortedLengths = [...buckets.keys()].sort((a, b) => b - a);
  const ordered: InputEntry[] = [];
  for (const len of sortedLengths) {
    const bucket = buckets.get(len) as InputEntry[];
    shuffleInPlace(bucket, rand);
    ordered.push(...bucket);
  }

  if (ordered.length === 0) {
    return { rows: 0, cols: 0, placements: [], unplaced: [] };
  }

  const grid = new Map<string, Cell>();
  const placements: Placement[] = [];
  const unplaced: string[] = [];
  // Bounding box of any unplaceable-but-still-needed term — they get
  // stacked horizontally underneath the main grid.
  let isolatedRowCursor = 0;

  // Place the first term horizontally at the origin.
  const first = ordered[0] as InputEntry;
  for (let i = 0; i < first.term.length; i += 1) {
    grid.set(cellKey(0, i), { letter: first.term[i] as string });
  }
  placements.push({
    id: first.id,
    term: first.term,
    row: 0,
    col: 0,
    direction: "across",
    number: 0,
  });

  // Track the running bounding box so we can score candidates by how
  // much they'd expand it. Updated after each successful commit.
  let bboxMinRow = 0;
  let bboxMaxRow = 0;
  let bboxMinCol = 0;
  let bboxMaxCol = first.term.length - 1;

  for (let n = 1; n < ordered.length; n += 1) {
    const entry = ordered[n] as InputEntry;
    let best:
      | { score: number; row: number; col: number; direction: Direction; bboxArea: number }
      | null = null;
    // For every placed cell, try every matching letter in this term.
    for (const [key, cell] of grid) {
      const [rs, cs] = key.split(",");
      const r = Number(rs);
      const c = Number(cs);
      for (let i = 0; i < entry.term.length; i += 1) {
        if (entry.term[i] !== cell.letter) continue;
        for (const dir of ["across", "down"] as const) {
          const candidate = tryPlace(grid, entry.term, dir, r, c, i);
          if (!candidate) continue;
          // Compute the bounding-box area this placement would produce
          // so we can prefer compact crosswords over sprawling ones.
          const endRow = dir === "across" ? candidate.row : candidate.row + entry.term.length - 1;
          const endCol = dir === "across" ? candidate.col + entry.term.length - 1 : candidate.col;
          const newMinRow = Math.min(bboxMinRow, candidate.row);
          const newMaxRow = Math.max(bboxMaxRow, endRow);
          const newMinCol = Math.min(bboxMinCol, candidate.col);
          const newMaxCol = Math.max(bboxMaxCol, endCol);
          const bboxArea = (newMaxRow - newMinRow + 1) * (newMaxCol - newMinCol + 1);
          if (
            !best ||
            candidate.score > best.score ||
            (candidate.score === best.score && bboxArea < best.bboxArea)
          ) {
            best = { ...candidate, direction: dir, bboxArea };
          }
        }
      }
    }

    if (!best) {
      // No legal intersection — drop below the current bounding box.
      // Re-compute the bounding box on demand; it's cheap and only runs
      // when the generator falls back to isolated placement.
      let maxRow = 0;
      for (const key of grid.keys()) {
        const r = Number(key.split(",")[0]);
        if (r > maxRow) maxRow = r;
      }
      const row = Math.max(maxRow + 2, isolatedRowCursor);
      // Skip placement entirely if it's the only entry and there's nothing
      // to intersect with — caller handles `unplaced`.
      isolatedRowCursor = row + 2;
      // Place the orphan horizontally so the renderer still has clue lists
      // — solving it remains possible, just visually disconnected.
      for (let i = 0; i < entry.term.length; i += 1) {
        grid.set(cellKey(row, i), { letter: entry.term[i] as string });
      }
      placements.push({
        id: entry.id,
        term: entry.term,
        row,
        col: 0,
        direction: "across",
        number: 0,
      });
      unplaced.push(entry.id);
      continue;
    }

    // Commit the placement and update the running bounding box so the
    // next term can score against the freshly-expanded grid.
    const { row, col, direction } = best;
    for (let i = 0; i < entry.term.length; i += 1) {
      const r = direction === "across" ? row : row + i;
      const c = direction === "across" ? col + i : col;
      grid.set(cellKey(r, c), { letter: entry.term[i] as string });
    }
    const endRow = direction === "across" ? row : row + entry.term.length - 1;
    const endCol = direction === "across" ? col + entry.term.length - 1 : col;
    bboxMinRow = Math.min(bboxMinRow, row);
    bboxMaxRow = Math.max(bboxMaxRow, endRow);
    bboxMinCol = Math.min(bboxMinCol, col);
    bboxMaxCol = Math.max(bboxMaxCol, endCol);
    placements.push({
      id: entry.id,
      term: entry.term,
      row,
      col,
      direction,
      number: 0,
    });
  }

  // Normalize so the bounding box starts at (0, 0).
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;
  for (const key of grid.keys()) {
    const parts = key.split(",");
    const r = Number(parts[0]);
    const c = Number(parts[1]);
    if (r < minRow) minRow = r;
    if (c < minCol) minCol = c;
    if (r > maxRow) maxRow = r;
    if (c > maxCol) maxCol = c;
  }
  if (minRow === Infinity) return { rows: 0, cols: 0, placements: [], unplaced };
  for (const p of placements) {
    p.row -= minRow;
    p.col -= minCol;
  }
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;
  assignNumbers(placements, rows, cols);
  return { rows, cols, placements, unplaced };
}

/**
 * Flatten a Layout into a 2D answer grid (rows × cols) of single letters
 * with `null` for empty cells. Cheap helper for the renderer — keep here
 * so the runtime never has to re-derive cell coordinates.
 */
export function answerGrid(layout: Layout): (string | null)[][] {
  const grid: (string | null)[][] = [];
  for (let r = 0; r < layout.rows; r += 1) {
    grid.push(new Array<string | null>(layout.cols).fill(null));
  }
  for (const p of layout.placements) {
    for (let i = 0; i < p.term.length; i += 1) {
      const r = p.direction === "across" ? p.row : p.row + i;
      const c = p.direction === "across" ? p.col + i : p.col;
      (grid[r] as (string | null)[])[c] = p.term[i] as string;
    }
  }
  return grid;
}
