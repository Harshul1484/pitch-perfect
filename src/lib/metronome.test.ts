import { describe, expect, it } from 'vitest';
import {
  BEATS_PER_BAR,
  MAX_BPM,
  MIN_BPM,
  advance,
  clampBpm,
  isAccent,
  secondsPerBeat,
} from './metronome';

describe('clampBpm', () => {
  it('holds the tempo inside a musical range', () => {
    expect(clampBpm(120)).toBe(120);
    expect(clampBpm(5)).toBe(MIN_BPM);
    expect(clampBpm(9000)).toBe(MAX_BPM);
  });

  it('rounds and rejects nonsense', () => {
    expect(clampBpm(119.6)).toBe(120);
    expect(clampBpm(Number.NaN)).toBe(MIN_BPM);
  });
});

describe('secondsPerBeat', () => {
  it('is half a second at 120 bpm', () => {
    expect(secondsPerBeat(120)).toBeCloseTo(0.5, 10);
  });

  it('is one second at 60 bpm', () => {
    expect(secondsPerBeat(60)).toBeCloseTo(1, 10);
  });
});

describe('isAccent', () => {
  it('accents the first beat of the bar only', () => {
    expect([0, 1, 2, 3].map((beat) => isAccent(beat))).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });
});

describe('advance', () => {
  const start = { nextBeatTime: 10, nextBeat: 0 };

  it('schedules nothing when no beat is due yet', () => {
    const { beats, state } = advance(start, 9.5, 120);

    expect(beats).toEqual([]);
    expect(state).toEqual(start);
  });

  it('schedules every beat inside the window, at exact times', () => {
    // 120 bpm is half a second a beat, so 10.0 to 11.2 holds three beats.
    const { beats } = advance(start, 11.2, 120);

    expect(beats.map((b) => b.time)).toEqual([10, 10.5, 11]);
    expect(beats.map((b) => b.beat)).toEqual([0, 1, 2]);
  });

  it('accents only the downbeat', () => {
    const { beats } = advance(start, 12.1, 120);

    expect(beats.map((b) => b.accent)).toEqual([true, false, false, false, true]);
  });

  it('wraps the bar at four beats', () => {
    const { beats, state } = advance(start, 12.1, 120);

    expect(beats.map((b) => b.beat)).toEqual([0, 1, 2, 3, 0]);
    expect(state.nextBeat).toBe(1);
  });

  it('carries its position across calls without drifting', () => {
    // Stepping window by window must land on the same times as one long call.
    let state = start;
    const times: number[] = [];

    for (let window = 10.1; window <= 14; window += 0.1) {
      const result = advance(state, window, 120);
      times.push(...result.beats.map((beat) => beat.time));
      state = result.state;
    }

    const oneShot = advance(start, 14, 120).beats.map((beat) => beat.time);
    expect(times).toEqual(oneShot);
    // Exact arithmetic, no accumulated error.
    expect(times[times.length - 1]).toBeCloseTo(13.5, 10);
  });

  it('applies a tempo change from the next beat onward', () => {
    const first = advance(start, 10.1, 120);
    const second = advance(first.state, 11.1, 60);

    expect(first.beats.map((b) => b.time)).toEqual([10]);
    // The beat after the change is a full second later, not half.
    expect(second.beats.map((b) => b.time)).toEqual([10.5]);
    expect(second.state.nextBeatTime).toBeCloseTo(11.5, 10);
  });

  it('does not spin forever after a long suspension', () => {
    const { beats } = advance(start, 1_000_000, 240);

    expect(beats.length).toBeLessThanOrEqual(1000);
  });

  it('uses four beats to the bar by default', () => {
    expect(BEATS_PER_BAR).toBe(4);
  });
});
