/**
 * Sargam notation for written notes.
 *
 * Degrees are stored relative to Sa, never as absolute pitches, so changing
 * the tonic transposes a piece rather than rewriting it. That is what sargam
 * means, and it is the whole reason this app treats Sa as movable.
 */

export interface NoteToken {
  kind: 'note';
  /** Semitones above Sa, 0 to 11. */
  degree: number;
  /** -1 mandra, 0 madhya, +1 taar. */
  saptak: number;
}

/** A dash: hold the previous note for another beat. */
export interface SustainToken {
  kind: 'sustain';
}

export type Token = NoteToken | SustainToken;
export type Line = Token[];

/**
 * One letter per degree. Lowercase is komal and capital M is tivra Ma — the
 * usual ASCII shorthand, and short enough to type at speed.
 */
export const DEGREE_LETTERS = [
  'S',
  'r',
  'R',
  'g',
  'G',
  'm',
  'M',
  'P',
  'd',
  'D',
  'n',
  'N',
] as const;

/** Mandra is marked with a comma, taar with an apostrophe. */
const MANDRA = ',';
const TAAR = "'";
export const SUSTAIN = '-';

export function letterToDegree(letter: string): number | null {
  const index = DEGREE_LETTERS.indexOf(letter as (typeof DEGREE_LETTERS)[number]);
  return index === -1 ? null : index;
}

export function encodeToken(token: Token): string {
  if (token.kind === 'sustain') return SUSTAIN;

  const letter = DEGREE_LETTERS[token.degree];
  if (token.saptak > 0) return letter + TAAR.repeat(Math.min(token.saptak, 2));
  if (token.saptak < 0) return letter + MANDRA.repeat(Math.min(-token.saptak, 2));
  return letter;
}

export function serializeLines(lines: Line[]): string {
  return lines.map((line) => line.map(encodeToken).join(' ')).join('\n');
}

/**
 * Read notation text back into tokens. Unrecognised characters are skipped
 * rather than throwing: this text can be hand-edited, and losing a whole piece
 * to one stray character would be worse than dropping the character.
 */
export function parseNotation(text: string): Line[] {
  return text.split('\n').map((row) =>
    row
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .flatMap<Token>((word) => {
        if (word === SUSTAIN) return [{ kind: 'sustain' }];

        const degree = letterToDegree(word[0]);
        if (degree === null) return [];

        const marks = word.slice(1);
        const taar = marks.split(TAAR).length - 1;
        const mandra = marks.split(MANDRA).length - 1;

        return [{ kind: 'note', degree, saptak: taar - mandra }];
      }),
  );
}

/** MIDI note for a token, with Sa of madhya saptak in octave 4. */
export function midiFor(token: NoteToken, tonic: number): number {
  return tonic + 60 + token.degree + 12 * token.saptak;
}

export function countNotes(lines: Line[]): number {
  return lines.reduce(
    (total, line) => total + line.filter((token) => token.kind === 'note').length,
    0,
  );
}

/** Append to the final line, starting one if there is none. */
export function appendToken(lines: Line[], token: Token): Line[] {
  if (lines.length === 0) return [[token]];
  return lines.map((line, index) =>
    index === lines.length - 1 ? [...line, token] : line,
  );
}

export function appendLine(lines: Line[]): Line[] {
  return [...lines, []];
}

/**
 * Remove the last token. An empty final line goes instead, so backspace walks
 * back over a line break the way it does in a text field.
 */
export function deleteLast(lines: Line[]): Line[] {
  if (lines.length === 0) return lines;

  const last = lines[lines.length - 1];
  if (last.length === 0) {
    return lines.length === 1 ? lines : lines.slice(0, -1);
  }

  return lines.map((line, index) =>
    index === lines.length - 1 ? line.slice(0, -1) : line,
  );
}
