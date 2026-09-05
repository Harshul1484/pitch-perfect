import type { Line, Token } from './composition';

/**
 * Editing notation at a caret.
 *
 * The caret sits *between* tokens: index 0 is before the first token and
 * index line.length is after the last. That is how a text caret behaves, and
 * it is what makes inserting in the middle and appending at the end the same
 * operation rather than two.
 */
export interface Caret {
  line: number;
  index: number;
}

export interface Edit {
  lines: Line[];
  caret: Caret;
}

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

/** Pull a caret back inside the document, whatever it was pointing at. */
export function clampCaret(lines: Line[], caret: Caret): Caret {
  if (lines.length === 0) return { line: 0, index: 0 };

  const line = clamp(caret.line, lines.length - 1);
  return { line, index: clamp(caret.index, lines[line].length) };
}

export function caretAtEnd(lines: Line[]): Caret {
  if (lines.length === 0) return { line: 0, index: 0 };
  const line = lines.length - 1;
  return { line, index: lines[line].length };
}

function replaceLine(lines: Line[], at: number, next: Line): Line[] {
  return lines.map((line, index) => (index === at ? next : line));
}

export function insertToken(lines: Line[], caret: Caret, token: Token): Edit {
  if (lines.length === 0) return { lines: [[token]], caret: { line: 0, index: 1 } };

  const at = clampCaret(lines, caret);
  const line = lines[at.line];
  const next = [...line.slice(0, at.index), token, ...line.slice(at.index)];

  return {
    lines: replaceLine(lines, at.line, next),
    caret: { line: at.line, index: at.index + 1 },
  };
}

/** Backspace: remove the token before the caret, or join onto the line above. */
export function deleteBefore(lines: Line[], caret: Caret): Edit {
  const at = clampCaret(lines, caret);
  if (lines.length === 0) return { lines, caret: at };

  if (at.index > 0) {
    const line = lines[at.line];
    const next = [...line.slice(0, at.index - 1), ...line.slice(at.index)];
    return {
      lines: replaceLine(lines, at.line, next),
      caret: { line: at.line, index: at.index - 1 },
    };
  }

  // At the start of a line: pull this line onto the end of the one above.
  if (at.line === 0) return { lines, caret: at };

  const previous = lines[at.line - 1];
  const merged = [...previous, ...lines[at.line]];
  const next = lines.filter((_, index) => index !== at.line);

  return {
    lines: replaceLine(next, at.line - 1, merged),
    caret: { line: at.line - 1, index: previous.length },
  };
}

/** Delete: remove the token after the caret, or pull the next line up. */
export function deleteAt(lines: Line[], caret: Caret): Edit {
  const at = clampCaret(lines, caret);
  if (lines.length === 0) return { lines, caret: at };

  const line = lines[at.line];

  if (at.index < line.length) {
    const next = [...line.slice(0, at.index), ...line.slice(at.index + 1)];
    return { lines: replaceLine(lines, at.line, next), caret: at };
  }

  if (at.line === lines.length - 1) return { lines, caret: at };

  const merged = [...line, ...lines[at.line + 1]];
  const next = lines.filter((_, index) => index !== at.line + 1);

  return { lines: replaceLine(next, at.line, merged), caret: at };
}

/** Enter: split the line at the caret. */
export function breakLine(lines: Line[], caret: Caret): Edit {
  if (lines.length === 0) return { lines: [[], []], caret: { line: 1, index: 0 } };

  const at = clampCaret(lines, caret);
  const line = lines[at.line];

  const next = [
    ...lines.slice(0, at.line),
    line.slice(0, at.index),
    line.slice(at.index),
    ...lines.slice(at.line + 1),
  ];

  return { lines: next, caret: { line: at.line + 1, index: 0 } };
}

export function moveLeft(lines: Line[], caret: Caret): Caret {
  const at = clampCaret(lines, caret);
  if (at.index > 0) return { line: at.line, index: at.index - 1 };
  if (at.line === 0) return at;
  return { line: at.line - 1, index: lines[at.line - 1].length };
}

export function moveRight(lines: Line[], caret: Caret): Caret {
  const at = clampCaret(lines, caret);
  if (at.index < lines[at.line].length) return { line: at.line, index: at.index + 1 };
  if (at.line === lines.length - 1) return at;
  return { line: at.line + 1, index: 0 };
}

export function moveUp(lines: Line[], caret: Caret): Caret {
  const at = clampCaret(lines, caret);
  if (at.line === 0) return { line: 0, index: 0 };
  return clampCaret(lines, { line: at.line - 1, index: at.index });
}

export function moveDown(lines: Line[], caret: Caret): Caret {
  const at = clampCaret(lines, caret);
  if (at.line === lines.length - 1) return caretAtEnd(lines);
  return clampCaret(lines, { line: at.line + 1, index: at.index });
}

export function moveLineStart(lines: Line[], caret: Caret): Caret {
  return { line: clampCaret(lines, caret).line, index: 0 };
}

export function moveLineEnd(lines: Line[], caret: Caret): Caret {
  const at = clampCaret(lines, caret);
  return { line: at.line, index: lines[at.line].length };
}
