import { describe, expect, it } from 'vitest';
import {
  ALL_NOTES,
  HIGHEST_MIDI,
  LOWEST_MIDI,
  frequencyOf,
  groupByOctave,
  nearestNote,
  noteAt,
} from './notes';

describe('frequencyOf', () => {
  it('anchors A4 at exactly 440 Hz', () => {
    expect(frequencyOf(69)).toBe(440);
  });

  it('doubles frequency across an octave', () => {
    expect(frequencyOf(81)).toBeCloseTo(880, 10);
    expect(frequencyOf(57)).toBeCloseTo(220, 10);
  });

  it('matches known equal-temperament values', () => {
    expect(frequencyOf(60)).toBeCloseTo(261.63, 2); // middle C
    expect(frequencyOf(LOWEST_MIDI)).toBeCloseTo(27.5, 2); // A0
    expect(frequencyOf(HIGHEST_MIDI)).toBeCloseTo(4186.01, 2); // C8
  });
});

describe('noteAt', () => {
  it('names naturals and their octave', () => {
    expect(noteAt(60)).toMatchObject({ name: 'C', octave: 4, label: 'C4' });
    expect(noteAt(69)).toMatchObject({ name: 'A', octave: 4, label: 'A4' });
  });

  it('flags sharps as accidentals', () => {
    expect(noteAt(61)).toMatchObject({ label: 'C♯4', isAccidental: true });
    expect(noteAt(60).isAccidental).toBe(false);
  });
});

describe('ALL_NOTES', () => {
  it('covers the 88 keys of a piano, A0 to C8', () => {
    expect(ALL_NOTES).toHaveLength(88);
    expect(ALL_NOTES[0].label).toBe('A0');
    expect(ALL_NOTES[87].label).toBe('C8');
  });

  it('ascends without gaps', () => {
    const gaps = ALL_NOTES.filter(
      (note, index) => index > 0 && note.midi !== ALL_NOTES[index - 1].midi + 1,
    );
    expect(gaps).toEqual([]);
  });

  it('includes 36 accidentals', () => {
    expect(ALL_NOTES.filter((note) => note.isAccidental)).toHaveLength(36);
  });
});

describe('groupByOctave', () => {
  it('splits into nine groups, ascending', () => {
    const groups = groupByOctave();

    expect(groups.map((group) => group.octave)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('leaves the first and last octaves partial', () => {
    const groups = groupByOctave();

    expect(groups[0].notes).toHaveLength(3); // A0, A♯0, B0
    expect(groups[8].notes).toHaveLength(1); // C8
    expect(groups[4].notes).toHaveLength(12);
  });

  it('accounts for every note', () => {
    const total = groupByOctave().reduce((sum, group) => sum + group.notes.length, 0);

    expect(total).toBe(ALL_NOTES.length);
  });
});

describe('nearestNote', () => {
  it('names an exactly-tuned pitch with zero cents', () => {
    expect(nearestNote(440)).toMatchObject({ cents: 0 });
    expect(nearestNote(440)!.note.label).toBe('A4');
    expect(nearestNote(261.6256)!.note.label).toBe('C4');
  });

  it('reports sharp as positive and flat as negative', () => {
    // 445 Hz is a familiar orchestral A, about 20 cents above 440.
    const sharp = nearestNote(445)!;
    expect(sharp.note.label).toBe('A4');
    expect(sharp.cents).toBeGreaterThan(0);
    expect(sharp.cents).toBeCloseTo(20, 0);

    const flat = nearestNote(435)!;
    expect(flat.note.label).toBe('A4');
    expect(flat.cents).toBeLessThan(0);
  });

  it('crosses to the neighbouring note past the halfway point', () => {
    // A quarter tone above A4 sits nearer A#4.
    expect(nearestNote(440 * 2 ** (0.51 / 12))!.note.label).toBe('A♯4');
    expect(nearestNote(440 * 2 ** (0.49 / 12))!.note.label).toBe('A4');
  });

  it('never reports more than a half semitone off', () => {
    for (let hz = 60; hz < 3000; hz += 7.3) {
      const match = nearestNote(hz);
      if (match) expect(Math.abs(match.cents)).toBeLessThanOrEqual(50);
    }
  });

  it('names the violin open strings in standard tuning', () => {
    expect(nearestNote(196.0)!.note.label).toBe('G3');
    expect(nearestNote(293.66)!.note.label).toBe('D4');
    expect(nearestNote(440)!.note.label).toBe('A4');
    expect(nearestNote(659.26)!.note.label).toBe('E5');
  });

  it('rejects frequencies outside the piano range and nonsense input', () => {
    expect(nearestNote(20)).toBeNull(); // below A0
    expect(nearestNote(5000)).toBeNull(); // above C8
    expect(nearestNote(0)).toBeNull();
    expect(nearestNote(-440)).toBeNull();
    expect(nearestNote(Number.NaN)).toBeNull();
  });
});
