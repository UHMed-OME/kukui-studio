import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { CrosswordConfig } from "@kukui/schemas";
import type { ActivityProps } from "../../types.js";
import { SafeHtml } from "../../safe-html.js";
import {
  answerGrid,
  generateLayout,
  type Direction,
  type Layout,
  type Placement,
} from "./generate.js";
import "./Crossword.css";

type CellCoord = { row: number; col: number };

type CellStatus = "neutral" | "correct" | "incorrect" | "revealed";

type State = {
  /** Random seed used to build the current layout. */
  seed: number;
  /** Per-cell user input, keyed `"row,col"`. */
  letters: Record<string, string>;
  /** Per-cell status — only "revealed" persists across reshuffle. */
  statuses: Record<string, CellStatus>;
  /** True once the learner submitted; no further edits accepted. */
  submitted: boolean;
};

function emptyState(seed: number): State {
  return { seed, letters: {}, statuses: {}, submitted: false };
}

const keyOf = (r: number, c: number) => `${r},${c}`;

/**
 * Map every active cell to the placements that pass through it. Used for
 * "jump to next cell in this clue" navigation.
 */
function indexCells(layout: Layout): {
  active: Set<string>;
  across: Map<string, Placement>;
  down: Map<string, Placement>;
} {
  const active = new Set<string>();
  const across = new Map<string, Placement>();
  const down = new Map<string, Placement>();
  for (const p of layout.placements) {
    for (let i = 0; i < p.term.length; i += 1) {
      const r = p.direction === "across" ? p.row : p.row + i;
      const c = p.direction === "across" ? p.col + i : p.col;
      const k = keyOf(r, c);
      active.add(k);
      if (p.direction === "across") across.set(k, p);
      else down.set(k, p);
    }
  }
  return { active, across, down };
}

export function Crossword({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<CrosswordConfig>) {
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3";
  const headingId = useId();
  const gridLiveId = useId();

  const behaviour = config.behaviour ?? {};
  const allowReveal = behaviour.allowReveal !== false;
  const allowReshuffle = behaviour.allowReshuffle !== false;
  const showHints = behaviour.showHints !== false;

  const ui = config.ui ?? {};
  const checkLabel = ui.checkButton ?? "Check";
  const revealLetterLabel = ui.revealLetterButton ?? "Reveal letter";
  const revealWordLabel = ui.revealWordButton ?? "Reveal word";
  const reshuffleLabel = ui.reshuffleButton ?? "New layout";
  const submitLabel = ui.submitButton ?? "Submit";

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData) ?? emptyState(makeSeed()),
  );

  // Rebuild layout whenever the seed or the config entry list changes.
  const layout = useMemo(
    () => generateLayout(config.entries, state.seed),
    [config.entries, state.seed],
  );
  const solution = useMemo(() => answerGrid(layout), [layout]);
  const cellIndex = useMemo(() => indexCells(layout), [layout]);
  const totalActiveCells = cellIndex.active.size;

  // Reset progress if the author edits the config — same pattern as Flashcards.
  useEffect(() => {
    setState(parseSuspend(suspendData) ?? emptyState(makeSeed()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (!onPersist) return;
    onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const [selected, setSelected] = useState<CellCoord | null>(null);
  const [direction, setDirection] = useState<Direction>("across");
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const focusCell = useCallback((r: number, c: number) => {
    const el = inputRefs.current.get(keyOf(r, c));
    el?.focus();
    el?.select();
  }, []);

  // Auto-select the first clue on first render so the learner can start
  // typing without hunting for the entry point.
  useEffect(() => {
    if (selected) return;
    const first = layout.placements[0];
    if (!first) return;
    setSelected({ row: first.row, col: first.col });
    setDirection(first.direction);
    // Focus is best-effort; tests sometimes mount without DOM focus support.
    queueMicrotask(() => focusCell(first.row, first.col));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const activePlacement = useMemo<Placement | null>(() => {
    if (!selected) return null;
    const k = keyOf(selected.row, selected.col);
    if (direction === "across") return cellIndex.across.get(k) ?? cellIndex.down.get(k) ?? null;
    return cellIndex.down.get(k) ?? cellIndex.across.get(k) ?? null;
  }, [selected, direction, cellIndex]);

  const isHighlighted = useCallback(
    (r: number, c: number) => {
      if (!activePlacement) return false;
      const p = activePlacement;
      for (let i = 0; i < p.term.length; i += 1) {
        const pr = p.direction === "across" ? p.row : p.row + i;
        const pc = p.direction === "across" ? p.col + i : p.col;
        if (pr === r && pc === c) return true;
      }
      return false;
    },
    [activePlacement],
  );

  /** Step the caret along the active direction by ±1, skipping inactive cells. */
  const step = useCallback(
    (delta: 1 | -1) => {
      if (!selected) return;
      const dr = direction === "down" ? delta : 0;
      const dc = direction === "across" ? delta : 0;
      let r = selected.row + dr;
      let c = selected.col + dc;
      while (r >= 0 && c >= 0 && r < layout.rows && c < layout.cols) {
        if (cellIndex.active.has(keyOf(r, c))) {
          setSelected({ row: r, col: c });
          focusCell(r, c);
          return;
        }
        r += dr;
        c += dc;
      }
    },
    [selected, direction, layout.rows, layout.cols, cellIndex.active, focusCell],
  );

  const setLetter = useCallback(
    (r: number, c: number, raw: string) => {
      if (state.submitted) return;
      const letter = raw.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 1);
      const k = keyOf(r, c);
      setState((s) => ({
        ...s,
        letters: letter ? { ...s.letters, [k]: letter } : omit(s.letters, k),
        // Erase any prior correctness signal on this cell — the learner is
        // editing again, so the old colour would be stale.
        statuses: s.statuses[k] === "revealed" ? s.statuses : omit(s.statuses, k),
      }));
    },
    [state.submitted],
  );

  const handleInputChange = (r: number, c: number, value: string) => {
    setLetter(r, c, value);
    // Only step forward if the user typed an actual letter — otherwise
    // backspace-clearing would jump them past the cell they just cleared.
    if (/[A-Za-z]/.test(value)) step(1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        if (direction !== "across") setDirection("across");
        else step(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (direction !== "across") setDirection("across");
        else step(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (direction !== "down") setDirection("down");
        else step(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (direction !== "down") setDirection("down");
        else step(-1);
        break;
      case "Backspace": {
        const k = keyOf(r, c);
        if (state.letters[k]) {
          // Clear in place; let the change handler do the work.
          setLetter(r, c, "");
        } else {
          step(-1);
        }
        e.preventDefault();
        break;
      }
      case " ":
      case "Tab":
        // Space toggles across/down; Tab is reserved for native flow.
        if (e.key === " ") {
          e.preventDefault();
          setDirection((d) => (d === "across" ? "down" : "across"));
        }
        break;
      default:
        break;
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (!cellIndex.active.has(keyOf(r, c))) return;
    if (selected && selected.row === r && selected.col === c) {
      setDirection((d) => (d === "across" ? "down" : "across"));
    } else {
      setSelected({ row: r, col: c });
    }
    focusCell(r, c);
  };

  const selectClue = (p: Placement) => {
    setSelected({ row: p.row, col: p.col });
    setDirection(p.direction);
    focusCell(p.row, p.col);
  };

  const cellStatus = (r: number, c: number): CellStatus =>
    state.statuses[keyOf(r, c)] ?? "neutral";

  const checkAll = () => {
    if (state.submitted) return;
    const nextStatuses: Record<string, CellStatus> = { ...state.statuses };
    for (const k of cellIndex.active) {
      const [rs, cs] = k.split(",");
      const r = Number(rs);
      const c = Number(cs);
      const expected = solution[r]?.[c];
      const given = state.letters[k];
      if (!expected || nextStatuses[k] === "revealed") continue;
      if (!given) {
        // Don't mark empty cells incorrect — just clear any stale status.
        delete nextStatuses[k];
        continue;
      }
      nextStatuses[k] = given === expected ? "correct" : "incorrect";
    }
    setState((s) => ({ ...s, statuses: nextStatuses }));
  };

  const revealLetter = () => {
    if (!selected || state.submitted) return;
    const { row, col } = selected;
    const expected = solution[row]?.[col];
    if (!expected) return;
    const k = keyOf(row, col);
    setState((s) => ({
      ...s,
      letters: { ...s.letters, [k]: expected },
      statuses: { ...s.statuses, [k]: "revealed" },
    }));
    step(1);
  };

  const revealWord = () => {
    if (!activePlacement || state.submitted) return;
    const p = activePlacement;
    const nextLetters = { ...state.letters };
    const nextStatuses = { ...state.statuses };
    for (let i = 0; i < p.term.length; i += 1) {
      const r = p.direction === "across" ? p.row : p.row + i;
      const c = p.direction === "across" ? p.col + i : p.col;
      const k = keyOf(r, c);
      nextLetters[k] = p.term[i] as string;
      // Don't overwrite an already-correct cell with "revealed" — the
      // learner earned that one.
      if (nextStatuses[k] !== "correct") nextStatuses[k] = "revealed";
    }
    setState((s) => ({ ...s, letters: nextLetters, statuses: nextStatuses }));
  };

  const reshuffle = () => {
    if (state.submitted) return;
    // Carry already-correct + revealed entries forward when their cell
    // contains the same letter in the new layout (rare but possible).
    setState((s) => ({
      ...s,
      seed: makeSeed(),
      letters: {},
      statuses: {},
    }));
    setSelected(null);
  };

  const allCorrect = useMemo(() => {
    if (totalActiveCells === 0) return false;
    for (const k of cellIndex.active) {
      const [rs, cs] = k.split(",");
      const r = Number(rs);
      const c = Number(cs);
      const expected = solution[r]?.[c];
      if (!expected) return false;
      if (state.letters[k] !== expected) return false;
    }
    return true;
  }, [cellIndex.active, solution, state.letters, totalActiveCells]);

  const filledCount = useMemo(() => {
    let n = 0;
    for (const k of cellIndex.active) if (state.letters[k]) n += 1;
    return n;
  }, [cellIndex.active, state.letters]);

  const correctCount = useMemo(() => {
    let n = 0;
    for (const k of cellIndex.active) {
      const [rs, cs] = k.split(",");
      const r = Number(rs);
      const c = Number(cs);
      if (state.letters[k] && state.letters[k] === solution[r]?.[c]) n += 1;
    }
    return n;
  }, [cellIndex.active, solution, state.letters]);

  const handleSubmit = () => {
    if (state.submitted) return;
    // Force a final check so any pending letters get a colour.
    const nextStatuses: Record<string, CellStatus> = { ...state.statuses };
    let raw = 0;
    let revealedCount = 0;
    for (const k of cellIndex.active) {
      const [rs, cs] = k.split(",");
      const r = Number(rs);
      const c = Number(cs);
      const expected = solution[r]?.[c];
      const given = state.letters[k];
      if (!expected) continue;
      if (given === expected) {
        // Revealed cells don't count for credit, but they're still "correct"
        // visually so the learner can see the final answer.
        if (nextStatuses[k] !== "revealed") {
          nextStatuses[k] = "correct";
          raw += 1;
        } else {
          nextStatuses[k] = "revealed";
          revealedCount += 1;
        }
      } else if (given) {
        nextStatuses[k] = "incorrect";
      }
    }
    // Revealed cells are subtracted from the denominator too — otherwise a
    // learner who fully solves a puzzle after using "Reveal word" still
    // reports raw < max and `success: false`. Convention: revealed cells
    // are "outside the grade" rather than "automatically wrong."
    const max = totalActiveCells - revealedCount;
    const nextState: State = { ...state, statuses: nextStatuses, submitted: true };
    setState(nextState);
    onSubmit({
      raw,
      max,
      success: raw === max && max > 0,
      suspendData: JSON.stringify(nextState),
    });
  };

  const acrossClues = layout.placements
    .filter((p) => p.direction === "across")
    .sort((a, b) => a.number - b.number);
  const downClues = layout.placements
    .filter((p) => p.direction === "down")
    .sort((a, b) => a.number - b.number);

  const cluesById = useMemo(
    () => Object.fromEntries(config.entries.map((e) => [e.id, e])),
    [config.entries],
  );

  const activeEntry = activePlacement ? cluesById[activePlacement.id] : null;

  return (
    <div className="kukui-cw">
      <article className="kukui-cw__frame" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="kukui-cw__title">
          {config.title}
        </HeadingTag>
        {config.prompt ? (
          <SafeHtml className="kukui-cw__prompt" html={config.prompt} />
        ) : null}

        <div className="kukui-cw__progress" role="status" aria-live="polite" id={gridLiveId}>
          {state.submitted ? (
            allCorrect ? (
              <span>Solved — {correctCount} of {totalActiveCells} cells correct. Submitted.</span>
            ) : (
              <span>
                Submitted — {correctCount} of {totalActiveCells} cells correct.
              </span>
            )
          ) : (
            <span>
              {filledCount} of {totalActiveCells} cells filled · {correctCount} correct so far
            </span>
          )}
        </div>

        <div className="kukui-cw__layout">
          <div
            className="kukui-cw__grid-wrap"
            role="group"
            aria-label="Crossword grid"
          >
            <div
              className="kukui-cw__grid"
              style={{
                gridTemplateColumns: `repeat(${layout.cols}, var(--kukui-cw-cell, 44px))`,
                gridTemplateRows: `repeat(${layout.rows}, var(--kukui-cw-cell, 44px))`,
              }}
            >
              {Array.from({ length: layout.rows }).flatMap((_, r) =>
                Array.from({ length: layout.cols }).map((__, c) => {
                  const k = keyOf(r, c);
                  const isActive = cellIndex.active.has(k);
                  if (!isActive) {
                    return <div key={k} className="kukui-cw__cell is-blank" aria-hidden="true" />;
                  }
                  const status = cellStatus(r, c);
                  const value = state.letters[k] ?? "";
                  const isSelected = selected?.row === r && selected?.col === c;
                  const highlighted = isHighlighted(r, c);
                  // Find a number if this is a starting cell.
                  const startsHere = layout.placements.find(
                    (p) => p.row === r && p.col === c,
                  );
                  return (
                    <label
                      key={k}
                      className={[
                        "kukui-cw__cell",
                        isSelected ? "is-selected" : "",
                        highlighted && !isSelected ? "is-highlighted" : "",
                        status === "correct" ? "is-correct" : "",
                        status === "incorrect" ? "is-incorrect" : "",
                        status === "revealed" ? "is-revealed" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => handleCellClick(r, c)}
                    >
                      {startsHere ? (
                        <span className="kukui-cw__cell-number" aria-hidden="true">
                          {startsHere.number}
                        </span>
                      ) : null}
                      <span className="sr-only">
                        Row {r + 1}, column {c + 1}
                        {status === "correct"
                          ? " — correct"
                          : status === "incorrect"
                            ? " — incorrect"
                            : status === "revealed"
                              ? " — revealed"
                              : ""}
                      </span>
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(k, el);
                          else inputRefs.current.delete(k);
                        }}
                        className="kukui-cw__input"
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={1}
                        value={value}
                        readOnly={state.submitted}
                        aria-label={`Row ${r + 1}, column ${c + 1}`}
                        onChange={(e) => handleInputChange(r, c, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, r, c)}
                        onFocus={() => setSelected({ row: r, col: c })}
                      />
                      {/* Text mark paired with the colour so it still reads
                       *   when colour alone isn't perceivable (WCAG 1.4.1). */}
                      {status === "correct" ? (
                        <span className="kukui-cw__mark" aria-hidden="true">
                          ✓
                        </span>
                      ) : status === "incorrect" ? (
                        <span className="kukui-cw__mark" aria-hidden="true">
                          ✗
                        </span>
                      ) : status === "revealed" ? (
                        <span className="kukui-cw__mark" aria-hidden="true">
                          ◔
                        </span>
                      ) : null}
                    </label>
                  );
                }),
              )}
            </div>

            <div className="kukui-cw__actions" role="group" aria-label="Crossword actions">
              <button
                type="button"
                className="kukui-cw__btn"
                onClick={checkAll}
                disabled={state.submitted || filledCount === 0}
              >
                {checkLabel}
              </button>
              {allowReveal ? (
                <>
                  <button
                    type="button"
                    className="kukui-cw__btn"
                    onClick={revealLetter}
                    disabled={state.submitted || !selected}
                  >
                    {revealLetterLabel}
                  </button>
                  <button
                    type="button"
                    className="kukui-cw__btn"
                    onClick={revealWord}
                    disabled={state.submitted || !activePlacement}
                  >
                    {revealWordLabel}
                  </button>
                </>
              ) : null}
              {allowReshuffle ? (
                <button
                  type="button"
                  className="kukui-cw__btn"
                  onClick={reshuffle}
                  disabled={state.submitted}
                >
                  {reshuffleLabel}
                </button>
              ) : null}
              <button
                type="button"
                className="kukui-cw__btn kukui-cw__btn--primary"
                onClick={handleSubmit}
                disabled={state.submitted}
              >
                {submitLabel}
              </button>
            </div>
          </div>

          <div className="kukui-cw__clues">
            {activeEntry && showHints && activeEntry.hint ? (
              <p className="kukui-cw__hint">
                <span className="kukui-cw__hint-label">Hint:</span> {activeEntry.hint}
              </p>
            ) : null}
            <ClueList
              heading="Across"
              clues={acrossClues}
              cluesById={cluesById}
              activeId={activePlacement?.direction === "across" ? activePlacement.id : null}
              onSelect={selectClue}
            />
            <ClueList
              heading="Down"
              clues={downClues}
              cluesById={cluesById}
              activeId={activePlacement?.direction === "down" ? activePlacement.id : null}
              onSelect={selectClue}
            />
            {layout.unplaced.length > 0 ? (
              <p className="kukui-cw__warning" role="note">
                {layout.unplaced.length} term
                {layout.unplaced.length === 1 ? " was" : "s were"} placed without a crossing —
                consider adding overlapping vocabulary for a tighter puzzle.
              </p>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}

function ClueList({
  heading,
  clues,
  cluesById,
  activeId,
  onSelect,
}: {
  heading: string;
  clues: Placement[];
  cluesById: Record<string, CrosswordConfig["entries"][number]>;
  activeId: string | null;
  onSelect: (p: Placement) => void;
}) {
  if (clues.length === 0) return null;
  return (
    <section className="kukui-cw__cluelist">
      <h3 className="kukui-cw__cluelist-heading">{heading}</h3>
      <ol className="kukui-cw__cluelist-items">
        {clues.map((p) => {
          const entry = cluesById[p.id];
          if (!entry) return null;
          const isActive = p.id === activeId;
          return (
            <li
              key={p.id}
              className={["kukui-cw__clue", isActive ? "is-active" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className="kukui-cw__clue-btn"
                onClick={() => onSelect(p)}
              >
                <span className="kukui-cw__clue-num">{p.number}.</span>
                <span className="kukui-cw__clue-text">{entry.definition}</span>
                <span className="kukui-cw__clue-len" aria-label={`${p.term.length} letters`}>
                  ({p.term.length})
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function makeSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

function omit<T extends Record<string, unknown>>(obj: T, k: string): T {
  if (!(k in obj)) return obj;
  const copy = { ...obj };
  delete (copy as Record<string, unknown>)[k];
  return copy;
}

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.seed !== "number") return null;
    return {
      seed: parsed.seed,
      letters:
        parsed.letters && typeof parsed.letters === "object"
          ? Object.fromEntries(
              Object.entries(parsed.letters).filter(
                ([, v]) => typeof v === "string" && v.length <= 1,
              ),
            )
          : {},
      statuses:
        parsed.statuses && typeof parsed.statuses === "object"
          ? (Object.fromEntries(
              Object.entries(parsed.statuses).filter(([, v]) =>
                ["neutral", "correct", "incorrect", "revealed"].includes(String(v)),
              ),
            ) as Record<string, CellStatus>)
          : {},
      submitted: parsed.submitted === true,
    };
  } catch {
    return null;
  }
}
