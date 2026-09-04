/**
 * The complete set of musical notes on an 88-key piano, A0 through C8,
 * in twelve-tone equal temperament tuned to A4 = 440 Hz.
 */

export const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;

export interface Note {
  /** MIDI note number, 21 (A0) through 108 (C8). */
  midi: number;
  /** Pitch class without the octave, e.g. `C♯`. */
  name: string;
  octave: number;
  /** Pitch class and octave together, e.g. `C♯4`. */
  label: string;
  /** Fundamental frequency in Hz. */
  frequency: number;
  /** True for the sharps — the black keys. */
  isAccidental: boolean;
}

/** A0, the lowest key on a standard piano. */
export const LOWEST_MIDI = 21;
/** C8, the highest key on a standard piano. */
export const HIGHEST_MIDI = 108;

const A4_MIDI = 69;
const A4_FREQUENCY = 440;

/** Equal-temperament frequency for a MIDI note number. */
export function frequencyOf(midi: number): number {
  return A4_FREQUENCY * 2 ** ((midi - A4_MIDI) / 12);
}

export function noteAt(midi: number): Note {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;

  return {
    midi,
    name,
    octave,
    label: `${name}${octave}`,
    frequency: frequencyOf(midi),
    isAccidental: name.includes('♯'),
  };
}

/** Every note from A0 to C8, ascending — 88 in total. */
export const ALL_NOTES: Note[] = Array.from(
  { length: HIGHEST_MIDI - LOWEST_MIDI + 1 },
  (_, index) => noteAt(LOWEST_MIDI + index),
);

export interface OctaveGroup {
  octave: number;
  notes: Note[];
}

/**
 * Split notes into octaves. The first and last groups are partial: octave 0
 * starts at A0, and octave 8 holds only C8.
 */
export function groupByOctave(notes: Note[] = ALL_NOTES): OctaveGroup[] {
  const groups = new Map<number, Note[]>();

  for (const note of notes) {
    const existing = groups.get(note.octave);
    if (existing) {
      existing.push(note);
    } else {
      groups.set(note.octave, [note]);
    }
  }

  return [...groups.entries()]
    .map(([octave, octaveNotes]) => ({ octave, notes: octaveNotes }))
    .sort((a, b) => a.octave - b.octave);
}

export interface PitchMatch {
  /** Nearest note to the detected frequency. */
  note: Note;
  /**
   * Distance from that note in cents, -50 to +50. Negative is flat, positive
   * sharp. A hundred cents is one semitone.
   */
  cents: number;
}

/** Within this many cents of centre counts as in tune. */
export const IN_TUNE_CENTS = 10;

/**
 * Map a frequency onto the nearest piano note plus its deviation in cents.
 * Returns null outside the 88-key range, where there is no note to name.
 */
export function nearestNote(frequency: number): PitchMatch | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;

  const exact = A4_MIDI + 12 * Math.log2(frequency / A4_FREQUENCY);
  const midi = Math.round(exact);

  if (midi < LOWEST_MIDI || midi > HIGHEST_MIDI) return null;

  return {
    note: noteAt(midi),
    cents: Math.round((exact - midi) * 100),
  };
}
