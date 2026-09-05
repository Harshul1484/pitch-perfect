/**
 * Undo and redo, as a stack of whole states.
 *
 * Notation documents are small — a few hundred tokens at most — so keeping a
 * copy per edit is cheaper than describing each change and being able to
 * invert it, and it cannot drift out of step with the document the way an
 * inverse-operation log can.
 *
 * One step per edit, with no coalescing. Each note is a deliberate act here,
 * unlike typing prose where undoing letter by letter would be tedious.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

/** Older states beyond this are dropped, so a long session cannot grow forever. */
export const HISTORY_LIMIT = 200;

export function initial<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/**
 * Record a new state. Anything that had been undone is discarded, because the
 * timeline just branched and the old future is no longer reachable.
 */
export function record<T>(history: History<T>, present: T): History<T> {
  const past = [...history.past, history.present].slice(-HISTORY_LIMIT);
  return { past, present, future: [] };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history;

  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history;

  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}
