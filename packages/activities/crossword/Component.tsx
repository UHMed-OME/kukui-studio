import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { CrosswordConfig } from "./schema.js";
import { ActivityHeader, SafeHtml, type ActivityProps } from "@kukui/core";
import { bandMessage, resolveScoring } from "@kukui/core/scoring";
import {
  answerGrid,
  generateLayout,
  type Direction,
  type Layout,
  type Placement,
} from "./generate.js";
import "./Component.css";

type CellCoord = { row: number; col: number };

type CellStatus = "neutral" | "correct" | "incorrect" | "revealed";

type State = {
  /** Random seed used to build the current layout. */
  seed: number;
  /**
   * Fingerprint of the entry list the layout was built from. A resumed
   * session whose config no longer matches this fingerprint would map the
   * saved letters onto a different grid, so mismatches reset progress.
   */
  fp: string;
  /** Per-cell user input, keyed `"row,col"`. */
  letters: Record<string, string>;
  /** Per-cell status: "revealed" cells sit outside the grade entirely. */
  statuses: Record<string, CellStatus>;
  /** True once the learner submitted; no further edits accepted. */
  submitted: boolean;
};

function emptyState(seed: number, fp: string): State {
  return { seed, fp, letters: {}, statuses: {}, submitted: false };
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

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<CrosswordConfig>) {
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

  const fingerprint = useMemo(() => fingerprintOf(config.entries), [config.entries]);

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData, fingerprint) ?? emptyState(makeSeed(), fingerprint),
  );

  // Effective scoring view (retry / pass threshold / bands / mode /
  // solutions). The default pass threshold is 100 so legacy configs keep
  // the original "success means a full clear" semantics; an authored
  // scoring.passPercentage still wins.
  const scoring = useMemo(
    () => resolveScoring(config, { mode: "points", passPercentage: 100 }),
    [config],
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
    setState(parseSuspend(suspendData, fingerprint) ?? emptyState(makeSeed(), fingerprint));
    setSolutionsRevealed(false);
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

  // Auto-select the first clue so the highlighted word gives the learner an
  // entry point. Selection only — never steal keyboard focus on mount; focus
  // moves only on explicit user intent (clicking a cell or a clue).
  useEffect(() => {
    if (selected) return;
    const first = layout.placements[0];
    if (!first) return;
    setSelected({ row: first.row, col: first.col });
    setDirection(first.direction);
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

  /**
   * Step the caret along the active word by ±1. Movement is clamped to the
   * cells of the active placement — the caret never skips over a blank gap
   * into an unrelated word that merely shares the row/column.
   */
  const step = useCallback(
    (delta: 1 | -1) => {
      if (!selected || !activePlacement) return;
      const p = activePlacement;
      const idx =
        p.direction === "across" ? selected.col - p.col : selected.row - p.row;
      const next = idx + delta;
      if (next < 0 || next >= p.term.length) return;
      const r = p.direction === "across" ? p.row : p.row + next;
      const c = p.direction === "across" ? p.col + next : p.col;
      setSelected({ row: r, col: c });
      focusCell(r, c);
    },
    [selected, activePlacement, focusCell],
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
      case " ": {
        // Space toggles across/down — but only on a cell that genuinely has
        // both, so we never flip into an orientation with no word. (Tab is
        // left to native focus flow; the input's onFocus reconciles direction.)
        e.preventDefault();
        const k = keyOf(r, c);
        if (cellIndex.across.has(k) && cellIndex.down.has(k)) {
          setDirection((d) => (d === "across" ? "down" : "across"));
        }
        break;
      }
      default:
        // Handle plain letter keys here rather than relying on onChange:
        // typing a letter over an identical letter (a crossing cell filled by
        // the other word, or a revealed cell) produces no value change, so no
        // change event would fire and the caret would stall. onChange remains
        // as the fallback for input methods that don't go through keydown.
        if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setLetter(r, c, e.key);
          step(1);
        }
        break;
    }
  };

  // Resolve a valid orientation for a cell, preferring `pref` when the cell
  // supports it. Keeps `direction` in sync with what's actually answerable so
  // step() never advances off the highlighted word — whether the cell was
  // reached by click, Tab, or arrow navigation.
  const orientationFor = (r: number, c: number, pref: Direction): Direction => {
    const k = keyOf(r, c);
    const hasAcross = cellIndex.across.has(k);
    const hasDown = cellIndex.down.has(k);
    if (pref === "across") return hasAcross ? "across" : hasDown ? "down" : "across";
    return hasDown ? "down" : hasAcross ? "across" : "down";
  };

  // Was the clicked cell already the selected one *before* this press? The
  // input's focus handler runs between pointerdown and click and updates
  // `selected`, so testing `selected` inside the click handler would see the
  // cell as "already selected" on a first click of a crossing cell and
  // wrongly flip the direction. Record the truth at pointerdown instead.
  const wasSelectedAtPointerDown = useRef(false);

  const handleCellPointerDown = (r: number, c: number) => {
    wasSelectedAtPointerDown.current =
      selected !== null && selected.row === r && selected.col === c;
  };

  const handleCellClick = (r: number, c: number) => {
    const k = keyOf(r, c);
    if (!cellIndex.active.has(k)) return;
    const wasSelected = wasSelectedAtPointerDown.current;
    wasSelectedAtPointerDown.current = false;
    // A cell can belong to an across word, a down word, or both. Keep
    // `direction` in sync with what's actually answerable here: otherwise a
    // cell with only an across word, clicked while direction is still "down",
    // leaves `step()` advancing vertically — so typing jumps to the next row
    // instead of running along the across answer the learner sees highlighted.
    const hasAcross = cellIndex.across.has(k);
    const hasDown = cellIndex.down.has(k);
    if (wasSelected) {
      // Re-clicking the already-selected cell toggles orientation, but only
      // when the cell genuinely has both — never flip into an orientation
      // with no word.
      if (hasAcross && hasDown) {
        setDirection((d) => (d === "across" ? "down" : "across"));
      }
    } else {
      setSelected({ row: r, col: c });
      // Prefer the current direction when this cell supports it; otherwise
      // snap to the one orientation it does have.
      setDirection((d) =>
        d === "across" ? (hasAcross ? "across" : "down") : hasDown ? "down" : "across",
      );
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
    // A fresh layout means fresh coordinates — letters and statuses can't
    // survive the move, so the learner restarts on the new board.
    setState((s) => ({
      ...s,
      seed: makeSeed(),
      letters: {},
      statuses: {},
    }));
    setSelected(null);
  };

  const filledCount = useMemo(() => {
    let n = 0;
    for (const k of cellIndex.active) if (state.letters[k]) n += 1;
    return n;
  }, [cellIndex.active, state.letters]);

  // Counts derived from the visible per-cell statuses. Statuses only exist
  // after the learner presses Check / Reveal / Submit, so surfacing these
  // never leaks correctness the grid isn't already showing.
  const statusCounts = useMemo(() => {
    let correct = 0;
    let incorrect = 0;
    let revealed = 0;
    for (const k of cellIndex.active) {
      const s = state.statuses[k];
      if (s === "correct") correct += 1;
      else if (s === "incorrect") incorrect += 1;
      else if (s === "revealed") revealed += 1;
    }
    return { correct, incorrect, revealed };
  }, [cellIndex.active, state.statuses]);

  // Revealed cells sit outside the grade: excluded from both the numerator
  // and the denominator (see handleSubmit).
  const gradedMax = totalActiveCells - statusCounts.revealed;

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
        // Revealed cells don't count for credit, but they're still shown
        // filled so the learner can see the final answer.
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
    let result: { raw: number; max: number; success: boolean };
    if (scoring.mode === "completion") {
      result = { raw: 1, max: 1, success: true };
    } else if (scoring.mode === "all-or-nothing") {
      const complete = raw === max;
      result = { raw: complete ? 1 : 0, max: 1, success: complete };
    } else {
      // Zero max (every cell revealed) means nothing scorable is left to
      // fail — completion semantics, success true.
      const success = max === 0 ? true : (raw / max) * 100 >= scoring.passPercentage;
      result = { raw, max, success };
    }
    const nextState: State = { ...state, statuses: nextStatuses, submitted: true };
    setState(nextState);
    onSubmit({
      ...result,
      suspendData: JSON.stringify(nextState),
    });
  };

  const tryAgain = () => {
    setState((s) => emptyState(s.seed, s.fp));
    setSelected(null);
    setSolutionsRevealed(false);
  };

  // Solution reveal after submit is a render-mode toggle, not a state
  // mutation — the graded statuses (and the persisted suspend payload)
  // stay exactly as submitted.
  const [solutionsRevealed, setSolutionsRevealed] = useState(false);

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
  const anyHints = useMemo(() => config.entries.some((e) => e.hint), [config.entries]);

  const pct = gradedMax === 0 ? 100 : Math.round((statusCounts.correct / gradedMax) * 100);
  const banner = state.submitted ? bandMessage(scoring.bands, pct) : null;
  const showScoreLine = state.submitted && scoring.mode !== "completion";

  return (
    <div className="kukui-cw">
      <article className="kukui-cw__frame" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          prompt={config.prompt ? <SafeHtml html={config.prompt} /> : undefined}
        />

        <div className="kukui-cw__progress" role="status" aria-live="polite" id={gridLiveId}>
          {state.submitted ? (
            <span>
              Submitted. {statusCounts.correct} of {gradedMax} scored cells correct
              {statusCounts.revealed > 0 ? `, ${statusCounts.revealed} revealed` : ""}.
            </span>
          ) : (
            /* Pre-submit this region reports fill progress only. Correctness
             * counts appear only once the learner has asked for them via
             * Check or Reveal (mirroring the visible cell marks) — announcing
             * a live correct count while typing would leak the answers. */
            <span>
              {filledCount} of {totalActiveCells} cells filled
              {statusCounts.correct + statusCounts.incorrect > 0
                ? ` · checked: ${statusCounts.correct} correct, ${statusCounts.incorrect} incorrect`
                : ""}
              {statusCounts.revealed > 0 ? ` · ${statusCounts.revealed} revealed` : ""}
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
                  const baseStatus = cellStatus(r, c);
                  // "Show solution" is display-only: unearned cells render as
                  // revealed with the answer letter, without touching state.
                  const showAsSolution =
                    solutionsRevealed && state.submitted && baseStatus !== "correct";
                  const status: CellStatus = showAsSolution ? "revealed" : baseStatus;
                  const value = showAsSolution
                    ? (solution[r]?.[c] ?? "")
                    : (state.letters[k] ?? "");
                  const isSelected = selected?.row === r && selected?.col === c;
                  const highlighted = isHighlighted(r, c);
                  // Find a number if this is a starting cell.
                  const startsHere = layout.placements.find(
                    (p) => p.row === r && p.col === c,
                  );
                  // Clue context for AT users: every word passing through this
                  // cell, e.g. "3 Across: Largest artery in the body."
                  const acrossHere = cellIndex.across.get(k);
                  const downHere = cellIndex.down.get(k);
                  const clueParts: string[] = [];
                  const acrossEntry = acrossHere ? cluesById[acrossHere.id] : null;
                  if (acrossHere && acrossEntry) {
                    clueParts.push(`${acrossHere.number} Across: ${acrossEntry.definition}.`);
                  }
                  const downEntry = downHere ? cluesById[downHere.id] : null;
                  if (downHere && downEntry) {
                    clueParts.push(`${downHere.number} Down: ${downEntry.definition}.`);
                  }
                  if (status === "correct") clueParts.push("Correct.");
                  else if (status === "incorrect") clueParts.push("Incorrect.");
                  else if (status === "revealed") clueParts.push("Revealed.");
                  const descId = `${gridLiveId}-cell-${r}-${c}`;
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
                      onPointerDown={() => handleCellPointerDown(r, c)}
                      onClick={() => handleCellClick(r, c)}
                    >
                      {startsHere ? (
                        <span className="kukui-cw__cell-number" aria-hidden="true">
                          {startsHere.number}
                        </span>
                      ) : null}
                      <span className="sr-only" id={descId}>
                        {clueParts.join(" ")}
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
                        aria-describedby={descId}
                        onChange={(e) => handleInputChange(r, c, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, r, c)}
                        onFocus={() => {
                          // Reconcile direction too — Tab/native focus moves
                          // here without going through handleCellClick.
                          setSelected({ row: r, col: c });
                          setDirection((d) => orientationFor(r, c, d));
                        }}
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
              {state.submitted ? (
                <>
                  {scoring.enableSolutionsButton ? (
                    <button
                      type="button"
                      className="kukui-cw__btn"
                      onClick={() => setSolutionsRevealed((v) => !v)}
                      aria-pressed={solutionsRevealed}
                    >
                      {solutionsRevealed ? "Hide solution" : "Show solution"}
                    </button>
                  ) : null}
                  {scoring.enableRetry ? (
                    <button
                      type="button"
                      className="kukui-cw__btn kukui-cw__btn--primary"
                      onClick={tryAgain}
                    >
                      Try again
                    </button>
                  ) : null}
                </>
              ) : (
                <button
                  type="button"
                  className="kukui-cw__btn kukui-cw__btn--primary"
                  onClick={handleSubmit}
                >
                  {submitLabel}
                </button>
              )}
            </div>
            {showScoreLine ? (
              <output className="kukui-cw__score">
                {statusCounts.correct} / {gradedMax}
                {banner ? <span className="kukui-cw__band"> · {banner}</span> : null}
              </output>
            ) : null}
          </div>

          <div className="kukui-cw__clues">
            {/* The hint slot renders (with reserved min-height) whenever any
              * entry carries a hint, so a hint appearing or disappearing never
              * reflows the clue lists below it. */}
            {showHints && anyHints ? (
              <p className="kukui-cw__hint">
                {activeEntry?.hint ? (
                  <>
                    <span className="kukui-cw__hint-label">Hint:</span> {activeEntry.hint}
                  </>
                ) : null}
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

/**
 * Stable fingerprint of the entry list (ids + uppercased terms) — the two
 * inputs the layout generator actually consumes. Stored in suspendData; a
 * mismatch on resume means the saved letters belong to a different grid,
 * so the session resets instead of scattering letters onto the wrong cells.
 */
function fingerprintOf(entries: readonly { id: string; term: string }[]): string {
  const src = entries.map((e) => `${e.id}:${e.term.toUpperCase()}`).join("|");
  let h = 5381;
  for (let i = 0; i < src.length; i += 1) {
    h = ((h << 5) + h + src.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function omit<T extends Record<string, unknown>>(obj: T, k: string): T {
  if (!(k in obj)) return obj;
  const copy = { ...obj };
  delete (copy as Record<string, unknown>)[k];
  return copy;
}

function parseSuspend(s: string | undefined, expectedFp: string): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.seed !== "number") return null;
    // Layout fingerprint mismatch (author edited the word list since this
    // session was saved, or a legacy payload without one): the letters were
    // typed against a different grid, so start fresh.
    if (parsed.fp !== expectedFp) return null;
    return {
      seed: parsed.seed,
      fp: expectedFp,
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
