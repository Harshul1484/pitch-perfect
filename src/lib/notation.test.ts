import { describe, expect, it } from 'vitest';
import { noteAt } from './notes';
import { degreeFrom, spokenLabel, swaraFor, swaraName } from './notation';

/** Pitch classes, C is 0. */
const C = 0;
const D = 2;
const F = 5;

const text = (midi: number, tonic: number) => swaraFor(midi, tonic).text;

describe('swaraFor with Sa on C', () => {
  it('maps the C major scale to the shuddha swaras', () => {
    const midis = [60, 62, 64, 65, 67, 69, 71];

    expect(midis.map((midi) => text(midi, C))).toEqual([
      'Sa',
      'Re',
      'Ga',
      'Ma',
      'Pa',
      'Dha',
      'Ni',
    ]);
    expect(midis.every((midi) => !swaraFor(midi, C).komal)).toBe(true);
    expect(midis.every((midi) => !swaraFor(midi, C).tivra)).toBe(true);
  });

  it('marks the black keys komal, except F sharp which is tivra Ma', () => {
    expect(swaraFor(61, C)).toMatchObject({ text: 'Re', komal: true });
    expect(swaraFor(63, C)).toMatchObject({ text: 'Ga', komal: true });
    expect(swaraFor(66, C)).toMatchObject({ text: 'Ma', tivra: true, komal: false });
    expect(swaraFor(68, C)).toMatchObject({ text: 'Dha', komal: true });
    expect(swaraFor(70, C)).toMatchObject({ text: 'Ni', komal: true });
  });

  it('gives Sa and Pa no altered form, as they are achala', () => {
    for (let midi = 21; midi <= 108; midi += 1) {
      const swara = swaraFor(midi, C);
      if (swara.text === 'Sa' || swara.text === 'Pa') {
        expect(swara.komal).toBe(false);
        expect(swara.tivra).toBe(false);
      }
    }
  });

  it('gives exactly one tivra swara, and it is Ma', () => {
    const tivra = Array.from({ length: 12 }, (_, step) => swaraFor(60 + step, C)).filter(
      (swara) => swara.tivra,
    );

    expect(tivra).toHaveLength(1);
    expect(tivra[0].text).toBe('Ma');
  });
});

describe('swaraFor with a moved Sa', () => {
  it('follows the tonic: Sa on D makes the D major scale shuddha', () => {
    const midis = [62, 64, 66, 67, 69, 71, 73];

    expect(midis.map((midi) => text(midi, D))).toEqual([
      'Sa',
      'Re',
      'Ga',
      'Ma',
      'Pa',
      'Dha',
      'Ni',
    ]);
    expect(midis.every((midi) => !swaraFor(midi, D).komal)).toBe(true);
  });

  it('makes C komal Ni when Sa is on D', () => {
    expect(swaraFor(60, D)).toMatchObject({ text: 'Ni', komal: true });
  });

  it('handles a tonic that wraps the octave, Sa on F', () => {
    expect(text(65, F)).toBe('Sa');
    expect(text(60, F)).toBe('Pa');
    expect(text(64, F)).toBe('Ni');
  });
});

describe('saptak', () => {
  it('leaves the octave holding Sa undotted, as madhya', () => {
    expect(swaraFor(60, C).saptak).toBe(0); // C4, Sa itself
    expect(swaraFor(71, C).saptak).toBe(0); // B4, still madhya
  });

  it('dots below for mandra and above for taar', () => {
    expect(swaraFor(48, C).saptak).toBe(-1); // C3
    expect(swaraFor(72, C).saptak).toBe(1); // C5
    expect(swaraFor(36, C).saptak).toBe(-2);
    expect(swaraFor(84, C).saptak).toBe(2);
  });

  it('moves the saptak boundary with the tonic', () => {
    // With Sa on D, madhya runs D4 upward, so C4 sits below it.
    expect(swaraFor(62, D).saptak).toBe(0); // D4 is Sa
    expect(swaraFor(60, D).saptak).toBe(-1); // C4 is now mandra
    expect(swaraFor(73, D).saptak).toBe(0); // C#5 is still madhya
  });
});

describe('degreeFrom', () => {
  it('never returns a negative degree', () => {
    for (let midi = 21; midi <= 108; midi += 1) {
      for (let tonic = 0; tonic < 12; tonic += 1) {
        const degree = degreeFrom(midi, tonic);
        expect(degree).toBeGreaterThanOrEqual(0);
        expect(degree).toBeLessThan(12);
      }
    }
  });
});

describe('spoken labels', () => {
  const middleC = noteAt(60);

  it('reads the Western name in Western mode', () => {
    expect(spokenLabel(middleC, 'western', C)).toBe('C4');
  });

  it('says komal and tivra aloud, since diacritics do not read', () => {
    expect(swaraName(swaraFor(61, C))).toBe('komal Re');
    expect(swaraName(swaraFor(66, C))).toBe('tivra Ma');
    expect(swaraName(swaraFor(60, C))).toBe('Sa');
  });

  it('keeps the Western name alongside, since a swara carries no octave', () => {
    expect(spokenLabel(middleC, 'sargam', C)).toBe('Sa, C4');
    expect(spokenLabel(middleC, 'sargam', D)).toBe('komal Ni, C4');
  });
});
