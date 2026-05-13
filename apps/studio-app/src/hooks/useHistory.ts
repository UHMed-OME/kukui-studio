import { useCallback, useState } from "react";

const MAX_HISTORY = 100;

/**
 * `useState`-shaped hook with built-in undo/redo. The current value
 * is the entry at `cursor` in a stack of past + future values; setting
 * a new value truncates any redo branch and appends a new entry.
 * Identical-reference writes are no-ops so component effects can call
 * the setter idempotently without polluting the history.
 *
 * Capped at MAX_HISTORY entries — older states drop off the front. The
 * cap matters for activities with many small edits (drag a pin around
 * for 30 seconds = ~60 entries) where unbounded growth would waste
 * memory on values the author can no longer undo to anyway.
 */
export interface History<T> {
  value: T;
  setValue: (next: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * Replace the history with a fresh single entry — used when the
   * author switches activity kinds, resets the form, or imports a new
   * config. Undo across those boundaries would yield invalid state for
   * the new kind, so the safer behaviour is to clear.
   */
  reset: (value: T) => void;
}

export function useHistory<T>(initial: T | (() => T)): History<T> {
  const [state, setState] = useState<{ stack: T[]; cursor: number }>(() => ({
    stack: [typeof initial === "function" ? (initial as () => T)() : initial],
    cursor: 0,
  }));

  const value = state.stack[state.cursor] as T;

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    setState((prev) => {
      const current = prev.stack[prev.cursor] as T;
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(current) : next;
      if (resolved === current) return prev;
      const truncated = prev.stack.slice(0, prev.cursor + 1);
      truncated.push(resolved);
      const trimmed =
        truncated.length > MAX_HISTORY
          ? truncated.slice(truncated.length - MAX_HISTORY)
          : truncated;
      return { stack: trimmed, cursor: trimmed.length - 1 };
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) =>
      prev.cursor > 0 ? { ...prev, cursor: prev.cursor - 1 } : prev,
    );
  }, []);

  const redo = useCallback(() => {
    setState((prev) =>
      prev.cursor < prev.stack.length - 1
        ? { ...prev, cursor: prev.cursor + 1 }
        : prev,
    );
  }, []);

  const reset = useCallback((next: T) => {
    setState({ stack: [next], cursor: 0 });
  }, []);

  return {
    value,
    setValue,
    undo,
    redo,
    canUndo: state.cursor > 0,
    canRedo: state.cursor < state.stack.length - 1,
    reset,
  };
}
