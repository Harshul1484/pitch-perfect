import { describe, expect, it } from 'vitest';
import { parseNotation, serializeLines, type Line } from './composition';
import {
  breakLine,
  caretAtEnd,
  clampCaret,
  deleteAt,
  deleteBefore,
  insertToken,
  moveDown,
  moveLeft,
  moveLineEnd,
  moveLineStart,
  moveRight,
  moveUp,
} from './caret';

const lines = (text: string): Line[] => parseNotation(text);
const text = serializeLines;
const G = { kind: 'note', degree: 4, saptak: 0 } as const;

describe('clampCaret', () => {
  it('pulls a caret back inside the document', () => {
    const doc = lines('S R\nG');

    expect(clampCaret(doc, { line: 9, index: 9 })).toEqual({ line: 1, index: 1 });
    expect(clampCaret(doc, { line: -1, index: -3 })).toEqual({ line: 0, index: 0 });
  });

  it('copes with an empty document', () => {
    expect(clampCaret([], { line: 2, index: 2 })).toEqual({ line: 0, index: 0 });
  });
});

describe('insertToken', () => {
  it('inserts in the middle, not only at the end', () => {
    const doc = lines('S R P');
    const result = insertToken(doc, { line: 0, index: 2 }, G);

    expect(text(result.lines)).toBe('S R G P');
    expect(result.caret).toEqual({ line: 0, index: 3 });
  });

  it('appends when the caret is at the end', () => {
    const doc = lines('S R');
    expect(text(insertToken(doc, caretAtEnd(doc), G).lines)).toBe('S R G');
  });

  it('inserts at the very start', () => {
    expect(text(insertToken(lines('S R'), { line: 0, index: 0 }, G).lines)).toBe('G S R');
  });

  it('starts a document that has no lines', () => {
    const result = insertToken([], { line: 0, index: 0 }, G);

    expect(text(result.lines)).toBe('G');
    expect(result.caret).toEqual({ line: 0, index: 1 });
  });

  it('does not mutate the lines it is given', () => {
    const doc = lines('S R');
    const before = text(doc);
    insertToken(doc, { line: 0, index: 1 }, G);

    expect(text(doc)).toBe(before);
  });
});

describe('deleteBefore', () => {
  it('removes the token to the left of the caret', () => {
    const result = deleteBefore(lines('S R G'), { line: 0, index: 2 });

    expect(text(result.lines)).toBe('S G');
    expect(result.caret).toEqual({ line: 0, index: 1 });
  });

  it('joins onto the line above when at the start of a line', () => {
    const result = deleteBefore(lines('S R\nG P'), { line: 1, index: 0 });

    expect(text(result.lines)).toBe('S R G P');
    // The caret sits at the join, so typing continues where the break was.
    expect(result.caret).toEqual({ line: 0, index: 2 });
  });

  it('does nothing at the very start of the document', () => {
    const doc = lines('S R');
    const result = deleteBefore(doc, { line: 0, index: 0 });

    expect(text(result.lines)).toBe('S R');
    expect(result.caret).toEqual({ line: 0, index: 0 });
  });
});

describe('deleteAt', () => {
  it('removes the token to the right of the caret', () => {
    const result = deleteAt(lines('S R G'), { line: 0, index: 1 });

    expect(text(result.lines)).toBe('S G');
    expect(result.caret).toEqual({ line: 0, index: 1 });
  });

  it('pulls the next line up when at the end of a line', () => {
    const result = deleteAt(lines('S R\nG'), { line: 0, index: 2 });

    expect(text(result.lines)).toBe('S R G');
  });

  it('does nothing at the very end of the document', () => {
    const doc = lines('S R');
    expect(text(deleteAt(doc, caretAtEnd(doc)).lines)).toBe('S R');
  });
});

describe('breakLine', () => {
  it('splits a line at the caret', () => {
    const result = breakLine(lines('S R G P'), { line: 0, index: 2 });

    expect(text(result.lines)).toBe('S R\nG P');
    expect(result.caret).toEqual({ line: 1, index: 0 });
  });

  it('leaves an empty line when breaking at the end', () => {
    const doc = lines('S R');
    const result = breakLine(doc, caretAtEnd(doc));

    expect(result.lines).toHaveLength(2);
    expect(result.lines[1]).toEqual([]);
  });
});

describe('moving', () => {
  const doc = lines('S R G\nP D');

  it('steps left and right within a line', () => {
    expect(moveRight(doc, { line: 0, index: 1 })).toEqual({ line: 0, index: 2 });
    expect(moveLeft(doc, { line: 0, index: 1 })).toEqual({ line: 0, index: 0 });
  });

  it('wraps to the neighbouring line at the edges', () => {
    expect(moveRight(doc, { line: 0, index: 3 })).toEqual({ line: 1, index: 0 });
    expect(moveLeft(doc, { line: 1, index: 0 })).toEqual({ line: 0, index: 3 });
  });

  it('stops at the ends of the document rather than wrapping round', () => {
    expect(moveLeft(doc, { line: 0, index: 0 })).toEqual({ line: 0, index: 0 });
    expect(moveRight(doc, { line: 1, index: 2 })).toEqual({ line: 1, index: 2 });
  });

  it('keeps the column when moving between lines, clamped to length', () => {
    expect(moveDown(doc, { line: 0, index: 1 })).toEqual({ line: 1, index: 1 });
    // The line below is shorter, so the caret lands at its end.
    expect(moveDown(doc, { line: 0, index: 3 })).toEqual({ line: 1, index: 2 });
    expect(moveUp(doc, { line: 1, index: 1 })).toEqual({ line: 0, index: 1 });
  });

  it('jumps to the start and end of a line', () => {
    expect(moveLineStart(doc, { line: 0, index: 2 })).toEqual({ line: 0, index: 0 });
    expect(moveLineEnd(doc, { line: 0, index: 0 })).toEqual({ line: 0, index: 3 });
  });
});

describe('a correction in the middle of a line', () => {
  it('fixes a wrong note without retyping the rest', () => {
    // "S R P G" where the P was meant to be m.
    let doc = lines('S R P G');
    let caret = { line: 0, index: 3 };

    ({ lines: doc, caret } = deleteBefore(doc, caret));
    ({ lines: doc, caret } = insertToken(doc, caret, {
      kind: 'note',
      degree: 5,
      saptak: 0,
    }));

    expect(text(doc)).toBe('S R m G');
    expect(caret).toEqual({ line: 0, index: 3 });
  });
});
