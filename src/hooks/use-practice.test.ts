import { act, renderHook } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePractice } from './use-practice';
import { noteAt, type PitchMatch } from '../lib/notes';

/**
 * The stateful half of practice mode: readings in, marks out, and one timeout
 * to fade them. Time is faked, because the whole feature is about how long a
 * colour stays and waiting real seconds to find out would be absurd.
 */

function match(midi: number, cents: number): PitchMatch {
  return { note: noteAt(midi), cents };
}

/** Play one pitch for `count` readings, 20ms apart, as the detector would. */
function play(
  rerender: (props: { heard: PitchMatch | null }) => void,
  midi: number,
  cents = 2,
  count = 10,
) {
  for (let step = 0; step < count; step += 1) {
    act(() => {
      vi.advanceTimersByTime(20);
    });
    // A new object each time: the detector never hands back the same one.
    rerender({ heard: match(midi, cents) });
  }
}

beforeEach(() => {
  // `performance` has to be faked explicitly: the hook measures elapsed time
  // with performance.now(), which is monotonic where Date.now() is not, and
  // the default fake clock leaves it running on real time.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
  });
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePractice', () => {
  it('records nothing while it is switched off', () => {
    const { result, rerender } = renderHook(
      ({ heard }) => usePractice(heard, 10, 5_000, false),
      { initialProps: { heard: null as PitchMatch | null } },
    );

    play(rerender, 69);

    expect(result.current.marks).toEqual({});
  });

  it('marks a note that was held', () => {
    const { result, rerender } = renderHook(
      ({ heard }) => usePractice(heard, 10, 5_000, true),
      { initialProps: { heard: null as PitchMatch | null } },
    );

    play(rerender, 69);

    expect(result.current.marks[69]).toMatchObject({ midi: 69, inTune: true });
  });

  it('marks a note played out of tune as out', () => {
    const { result, rerender } = renderHook(
      ({ heard }) => usePractice(heard, 10, 5_000, true),
      { initialProps: { heard: null as PitchMatch | null } },
    );

    play(rerender, 69, 35);

    expect(result.current.marks[69]).toMatchObject({ inTune: false });
  });

  it('forgets a mark once its hold has passed', () => {
    const { result, rerender } = renderHook(
      ({ heard }) => usePractice(heard, 10, 5_000, true),
      { initialProps: { heard: null as PitchMatch | null } },
    );

    play(rerender, 69);
    expect(result.current.marks[69]).toBeDefined();

    rerender({ heard: null });
    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(result.current.marks[69]).toBeUndefined();
  });

  it('keeps marks for ever when the hold is off', () => {
    const { result, rerender } = renderHook(
      ({ heard }) => usePractice(heard, 10, null, true),
      { initialProps: { heard: null as PitchMatch | null } },
    );

    play(rerender, 69);
    rerender({ heard: null });
    act(() => {
      vi.advanceTimersByTime(600_000);
    });

    expect(result.current.marks[69]).toBeDefined();
  });

  it('clears the bed when reset', () => {
    const { result, rerender } = renderHook(
      ({ heard }) => usePractice(heard, 10, null, true),
      { initialProps: { heard: null as PitchMatch | null } },
    );

    play(rerender, 69);
    act(() => result.current.reset());

    expect(result.current.marks).toEqual({});
  });

  it('drops everything it remembered when switched off', () => {
    const { result, rerender } = renderHook(
      ({ heard, on }: { heard: PitchMatch | null; on: boolean }) =>
        usePractice(heard, 10, null, on),
      { initialProps: { heard: null as PitchMatch | null, on: true } },
    );

    for (let step = 0; step < 10; step += 1) {
      act(() => {
        vi.advanceTimersByTime(20);
      });
      rerender({ heard: match(69, 2), on: true });
    }
    expect(result.current.marks[69]).toBeDefined();

    rerender({ heard: null, on: false });

    // Turning it back on should start a session, not resume one from an hour ago.
    expect(result.current.marks).toEqual({});
  });

  it('reports each attempt once, however many times it re-renders', () => {
    const seen: number[] = [];

    // Read the way a caller reads it: from an effect keyed on the value, so a
    // re-render carrying the same attempt does not count it twice.
    const { rerender } = renderHook(
      ({ heard }) => {
        const practice = usePractice(heard, 10, null, true);
        useEffect(() => {
          if (practice.committed) seen.push(practice.committed.midi);
        }, [practice.committed]);
        return practice;
      },
      { initialProps: { heard: null as PitchMatch | null } },
    );

    play(rerender, 69, 2, 20);
    expect(seen).toEqual([69]);

    // A different note is a second attempt, and is reported.
    play(rerender, 71, 2, 20);
    expect(seen).toEqual([69, 71]);
  });
});
