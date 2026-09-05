import { afterEach, describe, expect, it } from 'vitest';
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  clearHistory,
  initial,
  loadHistory,
  record,
  redo,
  saveHistory,
  undo,
} from './history';

describe('history', () => {
  it('starts with nothing to undo or redo', () => {
    const history = initial('a');

    expect(history.present).toBe('a');
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it('steps back and forward through recorded states', () => {
    let history = record(record(initial('a'), 'b'), 'c');
    expect(history.present).toBe('c');

    history = undo(history);
    expect(history.present).toBe('b');
    history = undo(history);
    expect(history.present).toBe('a');

    history = redo(history);
    expect(history.present).toBe('b');
  });

  it('refuses to step past either end', () => {
    const history = initial('a');

    expect(undo(history)).toEqual(history);
    expect(redo(history)).toEqual(history);
  });

  it('discards the redo trail once a new edit branches off it', () => {
    let history = record(record(initial('a'), 'b'), 'c');
    history = undo(history);
    expect(canRedo(history)).toBe(true);

    history = record(history, 'd');

    expect(canRedo(history)).toBe(false);
    expect(history.present).toBe('d');
    // Undo still reaches what came before the branch.
    expect(undo(history).present).toBe('b');
  });

  it('forgets the oldest states rather than growing without limit', () => {
    let history = initial(0);
    for (let step = 1; step <= HISTORY_LIMIT + 50; step += 1) {
      history = record(history, step);
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.present).toBe(HISTORY_LIMIT + 50);
    // The very first state has been dropped.
    expect(history.past[0]).not.toBe(0);
  });

  it('does not mutate the history it is given', () => {
    const history = record(initial('a'), 'b');
    const before = JSON.stringify(history);

    record(history, 'c');
    undo(history);

    expect(JSON.stringify(history)).toBe(before);
  });
});

describe('history across a reload', () => {
  afterEach(() => window.localStorage.clear());

  it('comes back when the document still matches', () => {
    const history = record(initial('a'), 'b');
    saveHistory('piece', history);

    const loaded = loadHistory<string>('piece', (present) => present === 'b');

    expect(loaded).not.toBeNull();
    expect(loaded?.present).toBe('b');
    expect(undo(loaded!).present).toBe('a');
  });

  it('is discarded when the document has moved on elsewhere', () => {
    saveHistory('piece', record(initial('a'), 'b'));

    // The piece now says something else, so those steps describe a document
    // that no longer exists.
    expect(loadHistory<string>('piece', (present) => present === 'z')).toBeNull();
  });

  it('is null when there is nothing stored', () => {
    expect(loadHistory<string>('missing', () => true)).toBeNull();
  });

  it('survives rubbish in storage rather than throwing', () => {
    window.localStorage.setItem('pitch.history.piece', 'not json');

    expect(loadHistory<string>('piece', () => true)).toBeNull();
  });

  it('can be cleared', () => {
    saveHistory('piece', initial('a'));
    clearHistory('piece');

    expect(loadHistory<string>('piece', () => true)).toBeNull();
  });

  it('keeps storage bounded', () => {
    let history = initial(0);
    for (let step = 1; step <= 300; step += 1) history = record(history, step);
    saveHistory('piece', history);

    const raw = window.localStorage.getItem('pitch.history.piece') ?? '';
    const stored = JSON.parse(raw) as { past: number[] };
    expect(stored.past.length).toBeLessThanOrEqual(40);
  });
});
