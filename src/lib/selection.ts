import { clampCaret, type Caret, type Edit } from './caret';
import type { Line } from './composition';

/**
 * Selecting a run of tokens.
 *
 * A selection is two carets: where it was started and where it has been
 * dragged to. Either may come first in the document, so everything here works
 * on the ordered pair rather than on anchor and focus directly.
 */
export interface Selection {
  anchor: Caret;
  focus: Caret;
}

export interface Range {
  start: Caret;
  end: Caret;
}

function isBefore(a: Caret, b: Caret): boolean {
  return a.line !== b.line ? a.line < b.line : a.index < b.index;
}

export function isEmpty(selection: Selection): boolean {
  return (
    selection.anchor.line === selection.focus.line &&
    selection.anchor.index === selection.focus.index
  );
}

/** The selection in document order. */
export function ordered(selection: Selection): Range {
  return isBefore(selection.anchor, selection.focus)
    ? { start: selection.anchor, end: selection.focus }
    : { start: selection.focus, end: selection.anchor };
}

export function selectAll(lines: Line[]): Selection {
  const last = Math.max(0, lines.length - 1);
  return {
    anchor: { line: 0, index: 0 },
    focus: { line: last, index: lines[last]?.length ?? 0 },
  };
}

/** The tokens inside a selection, as lines. */
export function extract(lines: Line[], selection: Selection): Line[] {
  if (isEmpty(selection)) return [];

  const { start, end } = ordered(selection);
  const from = clampCaret(lines, start);
  const to = clampCaret(lines, end);

  if (from.line === to.line) {
    return [lines[from.line].slice(from.index, to.index)];
  }

  return [
    lines[from.line].slice(from.index),
    ...lines.slice(from.line + 1, to.line),
    lines[to.line].slice(0, to.index),
  ];
}

/** Remove a selection, leaving the caret where it was. */
export function deleteRange(lines: Line[], selection: Selection): Edit {
  if (isEmpty(selection) || lines.length === 0) {
    return { lines, caret: clampCaret(lines, selection.focus) };
  }

  const { start, end } = ordered(selection);
  const from = clampCaret(lines, start);
  const to = clampCaret(lines, end);

  // What is left of the first and last lines, joined into one.
  const joined = [
    ...lines[from.line].slice(0, from.index),
    ...lines[to.line].slice(to.index),
  ];

  const next = [...lines.slice(0, from.line), joined, ...lines.slice(to.line + 1)];

  return { lines: next, caret: from };
}

/**
 * Insert lines at the caret, splicing the first and last into the line the
 * caret is on. Pasting a single line keeps everything on one line, which is
 * what pasting a phrase into the middle of another should do.
 */
export function insertLines(lines: Line[], caret: Caret, clip: Line[]): Edit {
  if (clip.length === 0) return { lines, caret: clampCaret(lines, caret) };
  if (lines.length === 0) {
    const last = clip.length - 1;
    return {
      lines: clip.map((line) => [...line]),
      caret: { line: last, index: clip[last].length },
    };
  }

  const at = clampCaret(lines, caret);
  const line = lines[at.line];
  const before = line.slice(0, at.index);
  const after = line.slice(at.index);

  if (clip.length === 1) {
    const merged = [...before, ...clip[0], ...after];
    return {
      lines: lines.map((existing, index) => (index === at.line ? merged : existing)),
      caret: { line: at.line, index: at.index + clip[0].length },
    };
  }

  const first = [...before, ...clip[0]];
  const middle = clip.slice(1, -1).map((row) => [...row]);
  const lastClip = clip[clip.length - 1];
  const last = [...lastClip, ...after];

  const next = [
    ...lines.slice(0, at.line),
    first,
    ...middle,
    last,
    ...lines.slice(at.line + 1),
  ];

  return {
    lines: next,
    caret: { line: at.line + clip.length - 1, index: lastClip.length },
  };
}
