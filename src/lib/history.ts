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

/**
 * Keeping history across a reload.
 *
 * Undo lives in localStorage keyed by the piece, not in Firestore. It is
 * per-person scratch state, it would bloat every document, and every keystroke
 * would become a write. Fewer states are kept than in memory, because this has
 * to be serialised on each edit.
 */
const STORED_STATES = 40;

function storageKey(pieceId: string): string {
  return `pitch.history.${pieceId}`;
}

export function saveHistory<T>(pieceId: string, history: History<T>): void {
  try {
    window.localStorage.setItem(
      storageKey(pieceId),
      JSON.stringify({
        past: history.past.slice(-STORED_STATES),
        present: history.present,
        future: history.future.slice(0, STORED_STATES),
      }),
    );
  } catch {
    // Losing undo across a reload is not worth failing an edit over.
  }
}

/**
 * Read history back, but only if its present state still matches the document
 * as saved. If the piece changed elsewhere — another device, another tab — the
 * stored steps describe a document that no longer exists, and replaying them
 * would resurrect it.
 */
export function loadHistory<T>(
  pieceId: string,
  matches: (present: T) => boolean,
): History<T> | null {
  try {
    const raw = window.localStorage.getItem(storageKey(pieceId));
    if (raw === null) return null;

    const parsed = JSON.parse(raw) as History<T>;
    if (!Array.isArray(parsed.past) || !Array.isArray(parsed.future)) return null;
    if (!matches(parsed.present)) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function clearHistory(pieceId: string): void {
  try {
    window.localStorage.removeItem(storageKey(pieceId));
  } catch {
    // Nothing to do.
  }
}
