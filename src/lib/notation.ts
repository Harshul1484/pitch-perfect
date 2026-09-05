import { NOTE_NAMES, type Note } from './notes';

/**
 * Note naming. Western letters, or Hindustani sargam in Bhatkhande notation.
 *
 * Sargam is relative, not absolute: Sa is whatever tonic the player chooses,
 * so the tonic is a setting rather than a constant. Fixing Sa at C would make
 * the whole mode useless to anyone who tunes elsewhere.
 */
export type Notation = 'western' | 'sargam';

export interface Swara {
  /** The bare letters: Sa Re Ga Ma Pa Dha Ni. Diacritics are rendered. */
  text: string;
  /** Komal — flattened. Written with an underline. */
  komal: boolean;
  /** Tivra — sharpened. Only Ma has one. Written with a line above. */
  tivra: boolean;
  /**
   * Octaves away from madhya saptak: 0 madhya, -1 mandra, +1 taar. Written as
   * dots below and above respectively.
   */
  saptak: number;
}

/**
 * The twelve degrees above Sa. Sa and Pa are achala — they have no altered
 * form — which is why neither appears twice.
 */
const DEGREES: readonly Omit<Swara, 'saptak'>[] = [
  { text: 'Sa', komal: false, tivra: false },
  { text: 'Re', komal: true, tivra: false },
  { text: 'Re', komal: false, tivra: false },
  { text: 'Ga', komal: true, tivra: false },
  { text: 'Ga', komal: false, tivra: false },
  { text: 'Ma', komal: false, tivra: false },
  { text: 'Ma', komal: false, tivra: true },
  { text: 'Pa', komal: false, tivra: false },
  { text: 'Dha', komal: true, tivra: false },
  { text: 'Dha', komal: false, tivra: false },
  { text: 'Ni', komal: true, tivra: false },
  { text: 'Ni', komal: false, tivra: false },
];

/** Pitch classes that can be chosen as Sa, indexed like NOTE_NAMES. */
export const TONICS = NOTE_NAMES;

/** The octave treated as madhya saptak, so middle Sa carries no dot. */
const MADHYA_OCTAVE = 4;

/** Semitones above the tonic, 0 to 11. */
export function degreeFrom(midi: number, tonic: number): number {
  return ((((midi % 12) - tonic) % 12) + 12) % 12;
}

/** The written form of a degree above Sa, with no saptak of its own. */
export function swaraOfDegree(degree: number): Omit<Swara, 'saptak'> {
  return DEGREES[((degree % 12) + 12) % 12];
}

export function swaraFor(midi: number, tonic: number): Swara {
  const madhyaSa = tonic + 12 * (MADHYA_OCTAVE + 1);

  return {
    ...swaraOfDegree(degreeFrom(midi, tonic)),
    saptak: Math.floor((midi - madhyaSa) / 12),
  };
}

/** Spoken form, e.g. "komal Re" or "tivra Ma". Diacritics do not read aloud. */
export function swaraName(swara: Swara): string {
  if (swara.komal) return `komal ${swara.text}`;
  if (swara.tivra) return `tivra ${swara.text}`;
  return swara.text;
}

/**
 * An unambiguous name, for screen readers and anywhere the octave matters.
 * Sargam keeps the Western name alongside, because saptak dots only span
 * three octaves and this key bed spans nine.
 */
export function spokenLabel(note: Note, notation: Notation, tonic: number): string {
  return notation === 'sargam'
    ? `${swaraName(swaraFor(note.midi, tonic))}, ${note.label}`
    : note.label;
}
