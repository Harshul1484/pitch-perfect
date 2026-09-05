import { describe, expect, it } from 'vitest';
import { parseNotation } from './composition';
import { beatAt, beatSeconds, buildSchedule, tokenAtBeat } from './playback';

/** Sa on C, so madhya Sa is MIDI 60. */
const C = 0;

const scheduleOf = (text: string, tonic = C) => buildSchedule(parseNotation(text), tonic);
const sounding = (text: string, tonic = C) =>
  scheduleOf(text, tonic).placed.filter((item) => item.midi !== null);

describe('buildSchedule', () => {
  it('gives every plain note one beat', () => {
    const { placed, totalBeats } = scheduleOf('S R G');

    expect(placed.map((item) => item.midi)).toEqual([60, 62, 64]);
    expect(placed.map((item) => item.startBeat)).toEqual([0, 1, 2]);
    expect(placed.every((item) => item.beats === 1)).toBe(true);
    expect(totalBeats).toBe(3);
  });

  it('extends a note for each hold that follows', () => {
    const { totalBeats } = scheduleOf('S - - R');
    const notes = sounding('S - - R');

    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatchObject({ startBeat: 0, beats: 3 });
    expect(notes[1]).toMatchObject({ startBeat: 3, beats: 1 });
    expect(totalBeats).toBe(4);
  });

  it('treats a leading hold as silence, not as extending anything', () => {
    const { totalBeats } = scheduleOf('- - S');
    const notes = sounding('- - S');

    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ startBeat: 2, beats: 1 });
    expect(totalBeats).toBe(3);
  });

  it('splits one beat between tied notes', () => {
    const notes = sounding('S ~R G');

    expect(notes.map((item) => item.startBeat)).toEqual([0, 0.5, 1]);
    expect(notes.map((item) => item.beats)).toEqual([0.5, 0.5, 1]);
    expect(scheduleOf('S ~R G').totalBeats).toBe(2);
  });

  it('splits a beat three ways when three notes are tied', () => {
    const notes = sounding('S ~R ~G');

    expect(notes).toHaveLength(3);
    expect(notes[1].startBeat).toBeCloseTo(1 / 3, 10);
    expect(notes.every((item) => Math.abs(item.beats - 1 / 3) < 1e-10)).toBe(true);
    expect(scheduleOf('S ~R ~G').totalBeats).toBe(1);
  });

  it('lets a hold lengthen the last note of a tied group', () => {
    const notes = sounding('S ~R -');

    expect(notes[1]).toMatchObject({ startBeat: 0.5 });
    // Half a beat of its own, plus the whole held beat.
    expect(notes[1].beats).toBeCloseTo(1.5, 10);
    expect(scheduleOf('S ~R -').totalBeats).toBe(2);
  });

  it('gives a bar line no time at all', () => {
    const { placed, totalBeats } = scheduleOf('S | R');
    const bar = placed.find((item) => item.beats === 0);

    expect(bar).toMatchObject({ startBeat: 1, midi: null });
    expect(totalBeats).toBe(2);
    expect(sounding('S | R').map((item) => item.startBeat)).toEqual([0, 1]);
  });

  it('runs straight through a line break', () => {
    const notes = sounding('S R\nG -');

    expect(notes.map((item) => item.startBeat)).toEqual([0, 1, 2]);
    expect(notes[2].beats).toBe(2);
    expect(scheduleOf('S R\nG -').totalBeats).toBe(4);
  });

  it('follows the tonic, so a piece transposes', () => {
    expect(sounding('S P', 2).map((item) => item.midi)).toEqual([62, 69]);
  });

  it('respects saptak marks', () => {
    expect(sounding("S, S S'").map((item) => item.midi)).toEqual([48, 60, 72]);
  });

  it('handles an empty page', () => {
    expect(buildSchedule([], C)).toEqual({ placed: [], totalBeats: 0 });
    expect(buildSchedule([[]], C)).toEqual({ placed: [], totalBeats: 0 });
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
  it('advances through the piece', () => {
    expect(beatAt(0, 120, 4)).toBe(0);
    expect(beatAt(0.25, 120, 4)).toBeCloseTo(0.5, 10);
    expect(beatAt(1.75, 120, 4)).toBeCloseTo(3.5, 10);
  });

  it('returns null once the piece is over', () => {
    expect(beatAt(2.01, 120, 4)).toBeNull();
  });

  it('returns null for an empty piece', () => {
    expect(beatAt(0, 120, 0)).toBeNull();
  });
});

describe('tokenAtBeat', () => {
  const schedule = scheduleOf('S ~R G -');

  it('finds the token sounding at a moment', () => {
    expect(tokenAtBeat(schedule, 0)).toBe(0);
    expect(tokenAtBeat(schedule, 0.75)).toBe(1);
    expect(tokenAtBeat(schedule, 1.2)).toBe(2);
  });

  it('lands on the hold once its beat arrives', () => {
    expect(tokenAtBeat(schedule, 2.5)).toBe(3);
  });

  it('is null past the end and when nothing is playing', () => {
    expect(tokenAtBeat(schedule, null)).toBeNull();
    expect(tokenAtBeat(schedule, 99)).toBeNull();
  });

  it('never lands on a bar, which takes no time', () => {
    const withBar = scheduleOf('S | R');

    expect(tokenAtBeat(withBar, 0.5)).toBe(0);
    expect(tokenAtBeat(withBar, 1)).toBe(2);
  });
});
