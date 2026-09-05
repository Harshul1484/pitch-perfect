import { describe, expect, it } from 'vitest';
import { EMPTY, HOLDS, expire, nextExpiry, observe, reset } from './practice';

const TOLERANCE = 10;

/** Feed a run of readings of one pitch, one every 20ms from `from`. */
function hold(state = EMPTY, midi = 69, cents = 0, from = 0, count = 10) {
  let current = state;
  let committed = null;

  for (let index = 0; index < count; index += 1) {
    const step = observe(current, { at: from + index * 20, midi, cents }, TOLERANCE);
    current = step.state;
    committed = step.committed ?? committed;
  }

  return { state: current, committed };
}

describe('observe', () => {
  it('ignores a pitch that was not held long enough to be a note', () => {
    // 90ms is the threshold; four readings 20ms apart is 60ms.
    const { state, committed } = hold(EMPTY, 69, 0, 0, 4);

    expect(committed).toBeNull();
    expect(state.marks).toEqual({});
  });

  it('commits a mark once the pitch has been held', () => {
    const { state, committed } = hold();

    expect(committed).toMatchObject({ midi: 69, inTune: true });
    expect(state.marks[69]).toMatchObject({ midi: 69, cents: 0, inTune: true });
  });

  it('marks a note played outside the tolerance as out', () => {
    const { state } = hold(EMPTY, 69, 25);

    expect(state.marks[69].inTune).toBe(false);
    expect(state.marks[69].cents).toBe(25);
  });

  it('averages the intonation across the attempt rather than taking the last', () => {
    let state = EMPTY;
    for (let index = 0; index < 10; index += 1) {
      // Alternates +20 and -20, so the attempt averages to zero.
      const cents = index % 2 === 0 ? 20 : -20;
      state = observe(state, { at: index * 20, midi: 69, cents }, TOLERANCE).state;
    }

    expect(state.marks[69].cents).toBe(0);
    expect(state.marks[69].inTune).toBe(true);
  });

  it('commits once per attempt, not once per reading', () => {
    let state = EMPTY;
    let commits = 0;

    for (let index = 0; index < 20; index += 1) {
      const step = observe(state, { at: index * 20, midi: 69, cents: 0 }, TOLERANCE);
      state = step.state;
      if (step.committed) commits += 1;
    }

    expect(commits).toBe(1);
  });

  it('keeps the mark fresh while the note is still being held', () => {
    const { state } = hold(EMPTY, 69, 0, 0, 30);

    // The fade should start when you leave the pitch, not when you found it.
    expect(state.marks[69].at).toBe(29 * 20);
  });

  it('replaces the previous attempt at the same pitch', () => {
    const first = hold(EMPTY, 69, 30).state;
    expect(first.marks[69].inTune).toBe(false);

    const second = hold(first, 69, 0, 1000).state;
    expect(second.marks[69].inTune).toBe(true);
  });

  it('treats a silence as the end of the attempt, not a pause in it', () => {
    // Badly, then a gap, then well. Averaging the two would report neither.
    const first = hold(EMPTY, 69, 40).state;
    const second = hold(first, 69, 0, 5_000).state;

    expect(second.marks[69].cents).toBe(0);
  });

  it('rides through the odd dropped reading within one attempt', () => {
    // 100ms is inside MAX_GAP_MS, so this is one note, not two.
    let state = hold(EMPTY, 69, 20, 0, 6).state;
    state = hold(state, 69, 20, 100 + 5 * 20, 6).state;

    expect(state.marks[69].cents).toBe(20);
  });

  it('starts a new attempt when the pitch changes', () => {
    const first = hold(EMPTY, 69).state;
    const second = hold(first, 71, 0, 1000).state;

    expect(Object.keys(second.marks).map(Number).sort()).toEqual([69, 71]);
  });
});

describe('expire', () => {
  it('drops a mark once its hold has run out', () => {
    const state = hold().state;
    const at = state.marks[69].at;

    expect(expire(state, at + 4_999, 5_000).marks[69]).toBeDefined();
    // The moment itself counts as up. The fade is scheduled for exactly this
    // instant, so a mark that survived it would never be removed at all.
    expect(expire(state, at + 5_000, 5_000).marks[69]).toBeUndefined();
    expect(expire(state, at + 5_001, 5_000).marks[69]).toBeUndefined();
  });

  it('keeps everything when there is no fade', () => {
    const state = hold().state;

    expect(expire(state, 10_000_000, null).marks[69]).toBeDefined();
  });

  it('returns the same state when nothing expired, so React can skip a render', () => {
    const state = hold().state;

    expect(expire(state, state.marks[69].at + 1, 5_000)).toBe(state);
  });
});

describe('nextExpiry', () => {
  it('is the oldest mark plus the hold', () => {
    let state = hold(EMPTY, 69, 0, 0).state;
    state = hold(state, 71, 0, 1_000).state;

    const oldest = state.marks[69].at;
    expect(nextExpiry(state, 5_000)).toBe(oldest + 5_000);
  });

  it('is nothing when there is no fade, or nothing to fade', () => {
    expect(nextExpiry(hold().state, null)).toBeNull();
    expect(nextExpiry(EMPTY, 5_000)).toBeNull();
  });
});

describe('reset', () => {
  it('clears the bed', () => {
    expect(reset().marks).toEqual({});
  });
});

describe('HOLDS', () => {
  it('offers the durations the player expects, ending in no fade', () => {
    expect(HOLDS.map((option) => option.label)).toEqual([
      '5s',
      '15s',
      '30s',
      '45s',
      '1m',
      '2m',
      '5m',
      'none',
    ]);
    expect(HOLDS[HOLDS.length - 1].ms).toBeNull();
  });
});
