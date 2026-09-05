import { describe, expect, it } from 'vitest';
import { parseNotation, serializeLines, type Line } from './composition';
import {
  deleteRange,
  extract,
  insertLines,
  isEmpty,
  ordered,
  selectAll,
  type Selection,
} from './selection';

const lines = (text: string): Line[] => parseNotation(text);
const text = serializeLines;
const at = (line: number, index: number) => ({ line, index });
const from = (a: [number, number], b: [number, number]): Selection => ({
  anchor: at(...a),
  focus: at(...b),
});

describe('ordered', () => {
  it('puts the earlier caret first, whichever end was dragged', () => {
    const forwards = from([0, 1], [0, 3]);
    const backwards = from([0, 3], [0, 1]);

    expect(ordered(forwards)).toEqual(ordered(backwards));
    expect(ordered(backwards).start).toEqual(at(0, 1));
  });

  it('orders across lines', () => {
    expect(ordered(from([2, 0], [1, 5])).start).toEqual(at(1, 5));
  });
});

describe('isEmpty', () => {
  it('is true when both ends are in the same place', () => {
    expect(isEmpty(from([0, 2], [0, 2]))).toBe(true);
    expect(isEmpty(from([0, 2], [0, 3]))).toBe(false);
  });
});

describe('extract', () => {
  it('takes a run from one line', () => {
    expect(text(extract(lines('S R G m P'), from([0, 1], [0, 3])))).toBe('R G');
  });

  it('takes nothing from an empty selection', () => {
    expect(extract(lines('S R'), from([0, 1], [0, 1]))).toEqual([]);
  });

  it('takes a run across lines, keeping the break', () => {
    const doc = lines('S R G\nm P\nD N');
    expect(text(extract(doc, from([0, 2], [2, 1])))).toBe('G\nm P\nD');
  });

  it('works when dragged backwards', () => {
    expect(text(extract(lines('S R G m'), from([0, 3], [0, 1])))).toBe('R G');
  });
});

describe('deleteRange', () => {
  it('removes a run within a line', () => {
    const result = deleteRange(lines('S R G m'), from([0, 1], [0, 3]));

    expect(text(result.lines)).toBe('S m');
    expect(result.caret).toEqual(at(0, 1));
  });

  it('joins the remainder when the run spans lines', () => {
    const result = deleteRange(lines('S R\nG m\nP'), from([0, 1], [2, 0]));

    expect(text(result.lines)).toBe('S P');
    expect(result.caret).toEqual(at(0, 1));
  });

  it('leaves the document alone for an empty selection', () => {
    const doc = lines('S R');
    expect(text(deleteRange(doc, from([0, 1], [0, 1])).lines)).toBe('S R');
  });

  it('does not mutate the lines it is given', () => {
    const doc = lines('S R G');
    const before = text(doc);
    deleteRange(doc, from([0, 0], [0, 2]));

    expect(text(doc)).toBe(before);
  });
});

describe('insertLines', () => {
  it('splices a single line into the middle', () => {
    const result = insertLines(lines('S P'), at(0, 1), lines('R G'));

    expect(text(result.lines)).toBe('S R G P');
    expect(result.caret).toEqual(at(0, 3));
  });

  it('keeps the breaks when pasting several lines', () => {
    const result = insertLines(lines('S P'), at(0, 1), lines('R\nG'));

    expect(text(result.lines)).toBe('S R\nG P');
    expect(result.caret).toEqual(at(1, 1));
  });

  it('pastes into an empty document', () => {
    expect(text(insertLines([], at(0, 0), lines('S R')).lines)).toBe('S R');
  });

  it('pasting nothing changes nothing', () => {
    expect(text(insertLines(lines('S R'), at(0, 1), []).lines)).toBe('S R');
  });
});

describe('selectAll', () => {
  it('spans the whole document', () => {
    const doc = lines('S R\nG m P');
    const all = selectAll(doc);

    expect(all.anchor).toEqual(at(0, 0));
    expect(all.focus).toEqual(at(1, 3));
    expect(text(extract(doc, all))).toBe('S R\nG m P');
  });
});

describe('cut and paste together', () => {
  it('moves a phrase from one line to another', () => {
    const doc = lines('S R G m\nP');
    const selection = from([0, 1], [0, 3]);

    const clip = extract(doc, selection);
    const cut = deleteRange(doc, selection);
    const pasted = insertLines(cut.lines, at(1, 1), clip);

    expect(text(pasted.lines)).toBe('S m\nP R G');
  });
});
