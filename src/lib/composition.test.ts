import { describe, expect, it } from 'vitest';
import {
  DEGREE_LETTERS,
  appendLine,
  appendToken,
  countNotes,
  deleteLast,
  encodeToken,
  letterToDegree,
  midiFor,
  parseNotation,
  serializeLines,
  type Line,
} from './composition';

const note = (degree: number, saptak = 0) => ({ kind: 'note', degree, saptak }) as const;

describe('DEGREE_LETTERS', () => {
  it('covers twelve degrees, each with its own letter', () => {
    expect(DEGREE_LETTERS).toHaveLength(12);
    expect(new Set(DEGREE_LETTERS).size).toBe(12);
  });

  it('uses capitals for shuddha and lowercase for komal', () => {
    expect(letterToDegree('S')).toBe(0);
    expect(letterToDegree('r')).toBe(1); // komal Re
    expect(letterToDegree('R')).toBe(2);
    expect(letterToDegree('m')).toBe(5);
    expect(letterToDegree('M')).toBe(6); // tivra Ma
    expect(letterToDegree('N')).toBe(11);
  });

  it('rejects a letter that is not a swara', () => {
    expect(letterToDegree('x')).toBeNull();
    expect(letterToDegree('')).toBeNull();
  });
});

describe('encodeToken', () => {
  it('writes a plain swara as its letter', () => {
    expect(encodeToken(note(0))).toBe('S');
    expect(encodeToken(note(1))).toBe('r');
  });

  it('marks taar with apostrophes and mandra with commas', () => {
    expect(encodeToken(note(0, 1))).toBe("S'");
    expect(encodeToken(note(0, 2))).toBe("S''");
    expect(encodeToken(note(11, -1))).toBe('N,');
    expect(encodeToken(note(11, -2))).toBe('N,,');
  });

  it('writes a sustain as a dash', () => {
    expect(encodeToken({ kind: 'sustain' })).toBe('-');
  });
});

describe('parseNotation', () => {
  it('reads a line of swaras', () => {
    expect(parseNotation('S R G m P')).toEqual([
      [note(0), note(2), note(4), note(5), note(7)],
    ]);
  });

  it('reads saptak marks', () => {
    expect(parseNotation("S' N, S''")).toEqual([[note(0, 1), note(11, -1), note(0, 2)]]);
  });

  it('reads sustains', () => {
    expect(parseNotation('S - -')).toEqual([
      [note(0), { kind: 'sustain' }, { kind: 'sustain' }],
    ]);
  });

  it('splits on newlines and tolerates ragged spacing', () => {
    expect(parseNotation('S  R\n\n  G ')).toEqual([[note(0), note(2)], [], [note(4)]]);
  });

  it('skips characters it does not know rather than throwing', () => {
    expect(parseNotation('S xyz R')).toEqual([[note(0), note(2)]]);
  });

  it('round-trips through serialization', () => {
    const text = "S r R' g,\nG m M P\n- - d D n N";
    expect(serializeLines(parseNotation(text))).toBe(text);
  });

  it('reads back a phrase from the notebook', () => {
    // "Sa Re ma Pa ma Pa / komal Ni Dha Pa"
    expect(serializeLines(parseNotation('S R m P m P\nn D P'))).toBe(
      'S R m P m P\nn D P',
    );
  });
});

describe('midiFor', () => {
  it('puts madhya Sa at C4 when the tonic is C', () => {
    expect(midiFor(note(0), 0)).toBe(60);
  });

  it('follows the tonic', () => {
    // Sa on D means madhya Sa is D4, and Pa above it is A4.
    expect(midiFor(note(0), 2)).toBe(62);
    expect(midiFor(note(7), 2)).toBe(69);
  });

  it('shifts an octave per saptak', () => {
    expect(midiFor(note(0, 1), 0)).toBe(72);
    expect(midiFor(note(0, -1), 0)).toBe(48);
  });
});

describe('editing', () => {
  const start: Line[] = [[note(0), note(2)]];

  it('appends to the last line', () => {
    expect(appendToken(start, note(4))).toEqual([[note(0), note(2), note(4)]]);
  });

  it('starts a line when there is none', () => {
    expect(appendToken([], note(0))).toEqual([[note(0)]]);
  });

  it('appends to the new line after a line break', () => {
    expect(appendToken(appendLine(start), note(4))).toEqual([
      [note(0), note(2)],
      [note(4)],
    ]);
  });

  it('deletes the last token', () => {
    expect(deleteLast(start)).toEqual([[note(0)]]);
  });

  it('walks back over a line break when the line is empty', () => {
    expect(deleteLast(appendLine(start))).toEqual(start);
  });

  it('never removes the only line', () => {
    expect(deleteLast([[]])).toEqual([[]]);
    expect(deleteLast([])).toEqual([]);
  });

  it('does not mutate what it is given', () => {
    const before = JSON.stringify(start);
    appendToken(start, note(9));
    deleteLast(start);
    expect(JSON.stringify(start)).toBe(before);
  });
});

describe('countNotes', () => {
  it('counts notes and ignores sustains', () => {
    expect(countNotes(parseNotation('S - R -\nG'))).toBe(3);
    expect(countNotes([])).toBe(0);
  });
});
