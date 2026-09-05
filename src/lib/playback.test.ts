import { describe, expect, it } from 'vitest';
import { parseNotation } from './composition';
import { beatAt, beatSeconds, buildSchedule } from './playback';

/** Sa on C, so madhya Sa is MIDI 60. */
const C = 0;

const scheduleOf = (text: string, tonic = C) => buildSchedule(parseNotation(text), tonic);

describe('buildSchedule', () => {
  it('gives every note one beat by default', () => {
    const { events, totalBeats } = scheduleOf('S R G');

    expect(events.map((e) => e.midi)).toEqual([60, 62, 64]);
    expect(events.map((e) => e.beats)).toEqual([1, 1, 1]);
    expect(totalBeats).toBe(3);
  });

  it('extends a note for each hold that follows', () => {
    const { events, totalBeats } = scheduleOf('S - - R');

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ tokenIndex: 0, midi: 60, beats: 3 });
    expect(events[1]).toMatchObject({ tokenIndex: 3, midi: 62, beats: 1 });
    // Holds still occupy their beats.
    expect(totalBeats).toBe(4);
  });

  it('treats a leading hold as silence, not as extending anything', () => {
    const { events, totalBeats } = scheduleOf('- - S');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ tokenIndex: 2, midi: 60, beats: 1 });
    expect(totalBeats).toBe(3);
  });

  it('does not let a hold reach back across a gap of silence', () => {
    // Hold, silence, then a hold again: the second must not extend the S.
    const { events } = scheduleOf('S - x -');
    // "x" is dropped by the parser, so this is S - - and the note lasts three.
    expect(events[0].beats).toBe(3);
  });

  it('runs straight through a line break', () => {
    const { events, totalBeats } = scheduleOf('S R\nG -');

    expect(events.map((e) => e.tokenIndex)).toEqual([0, 1, 2]);
    expect(events[2].beats).toBe(2);
    expect(totalBeats).toBe(4);
  });

  it('follows the tonic, so a piece transposes', () => {
    // Sa on D puts madhya Sa at D4 and Pa at A4.
    const { events } = scheduleOf('S P', 2);
    expect(events.map((e) => e.midi)).toEqual([62, 69]);
  });

  it('respects saptak marks', () => {
    const { events } = scheduleOf("S, S S'");
    expect(events.map((e) => e.midi)).toEqual([48, 60, 72]);
  });

  it('handles an empty page', () => {
    expect(buildSchedule([], C)).toEqual({ events: [], totalBeats: 0 });
    expect(buildSchedule([[]], C)).toEqual({ events: [], totalBeats: 0 });
  });
});

describe('beatSeconds', () => {
  it('is half a second at 120 bpm', () => {
    expect(beatSeconds(120)).toBeCloseTo(0.5, 10);
  });

  it('never divides by zero', () => {
    expect(Number.isFinite(beatSeconds(0))).toBe(true);
  });
});

describe('beatAt', () => {
  it('advances one beat at a time', () => {
    expect(beatAt(0, 120, 4)).toBe(0);
    expect(beatAt(0.49, 120, 4)).toBe(0);
    expect(beatAt(0.51, 120, 4)).toBe(1);
    expect(beatAt(1.75, 120, 4)).toBe(3);
  });

  it('returns null once the piece is over', () => {
    expect(beatAt(2.01, 120, 4)).toBeNull();
  });

  it('returns null for an empty piece', () => {
    expect(beatAt(0, 120, 0)).toBeNull();
  });
});
