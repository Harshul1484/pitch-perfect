import { describe, expect, it } from 'vitest';
import { detectPitch, rootMeanSquare } from './pitch';

const SAMPLE_RATE = 44100;
const WINDOW = 2048;

/** Relative harmonic amplitudes roughly like a bowed string. */
const BOWED = [1, 0.65, 0.45, 0.3, 0.2, 0.12];

function tone(
  frequency: number,
  harmonics: number[] = [1],
  length = WINDOW,
  sampleRate = SAMPLE_RATE,
): Float32Array {
  const buffer = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    let sample = 0;
    for (let h = 0; h < harmonics.length; h += 1) {
      const partial = frequency * (h + 1);
      if (partial >= sampleRate / 2) break; // above Nyquist, would alias
      sample += harmonics[h] * Math.sin((2 * Math.PI * partial * i) / sampleRate);
    }
    buffer[i] = sample;
  }

  let peak = 0;
  for (const sample of buffer) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0) {
    for (let i = 0; i < buffer.length; i += 1) buffer[i] = (buffer[i] / peak) * 0.8;
  }

  return buffer;
}

function centsBetween(detected: number, expected: number): number {
  return 1200 * Math.log2(detected / expected);
}

describe('rootMeanSquare', () => {
  it('is zero for silence', () => {
    expect(rootMeanSquare(new Float32Array(512))).toBe(0);
  });

  it('is the amplitude over root two for a sine', () => {
    expect(rootMeanSquare(tone(440))).toBeCloseTo(0.8 / Math.SQRT2, 2);
  });
});

describe('detectPitch on pure sines', () => {
  const cases = [
    ['A4', 440],
    ['A3', 220],
    ['C4', 261.63],
    ['E5', 659.25],
    ['A5', 880],
  ] as const;

  it.each(cases)('finds %s within 5 cents', (_name, frequency) => {
    const reading = detectPitch(tone(frequency), SAMPLE_RATE);

    expect(reading).not.toBeNull();
    expect(Math.abs(centsBetween(reading!.frequency, frequency))).toBeLessThan(5);
  });
});

describe('detectPitch on bowed-string timbre', () => {
  // Open strings in standard violin tuning, plus the scordatura cases that
  // motivated keeping the full 88-key range.
  const cases = [
    ['G3, lowest violin string', 196.0],
    ['D4', 293.66],
    ['A4', 440],
    ['E5, highest open string', 659.25],
    ['D3, dropped tuning', 146.83],
    ['F3, cross tuning', 174.61],
  ] as const;

  it.each(cases)('finds %s within 8 cents', (_name, frequency) => {
    const reading = detectPitch(tone(frequency, BOWED), SAMPLE_RATE);

    expect(reading).not.toBeNull();
    expect(Math.abs(centsBetween(reading!.frequency, frequency))).toBeLessThan(8);
  });

  it('does not jump an octave on a harmonic-rich tone', () => {
    // The failure mode this guards: locking onto the second harmonic and
    // reporting 392 Hz for an open G string.
    const reading = detectPitch(tone(196, BOWED), SAMPLE_RATE);

    expect(reading!.frequency).toBeLessThan(196 * 1.5);
    expect(reading!.frequency).toBeGreaterThan(196 / 1.5);
  });
});

describe('detectPitch rejects what is not a pitch', () => {
  it('returns null for silence', () => {
    expect(detectPitch(new Float32Array(WINDOW), SAMPLE_RATE)).toBeNull();
  });

  it('returns null for a signal below the silence floor', () => {
    const quiet = tone(440);
    for (let i = 0; i < quiet.length; i += 1) quiet[i] *= 0.001;

    expect(detectPitch(quiet, SAMPLE_RATE)).toBeNull();
  });

  it('returns null for white noise', () => {
    let seed = 12345;
    const noise = new Float32Array(WINDOW);
    for (let i = 0; i < noise.length; i += 1) {
      // Deterministic LCG so the test cannot flake.
      seed = (seed * 1103515245 + 12345) % 2147483648;
      noise[i] = (seed / 2147483648) * 2 - 1;
    }

    expect(detectPitch(noise, SAMPLE_RATE)).toBeNull();
  });
});

describe('detectPitch clarity', () => {
  it('reports near-perfect clarity for a clean sine', () => {
    const reading = detectPitch(tone(440), SAMPLE_RATE);

    expect(reading!.clarity).toBeGreaterThan(0.95);
    expect(reading!.clarity).toBeLessThanOrEqual(1);
  });
});

describe('detectPitch on quiet input', () => {
  it('still finds the pitch at the level a fake capture device delivers', () => {
    // Chrome's fake microphone feeds audio at roughly 1% of full scale.
    // A real microphone is far louder, so this is the harsher case.
    const quiet = tone(196, BOWED);
    for (let i = 0; i < quiet.length; i += 1) quiet[i] *= 0.01;

    const reading = detectPitch(quiet, SAMPLE_RATE);

    expect(reading).not.toBeNull();
    expect(Math.abs(centsBetween(reading!.frequency, 196))).toBeLessThan(8);
  });

  it('keeps a wide margin between a tone and noise', () => {
    // The gap that justifies the clarity threshold. If this ever narrows,
    // the threshold needs revisiting rather than nudging.
    const tonal = detectPitch(tone(440, BOWED), SAMPLE_RATE, 0);

    let seed = 999;
    const noise = new Float32Array(WINDOW);
    for (let i = 0; i < noise.length; i += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      noise[i] = (seed / 2147483648) * 2 - 1;
    }
    const noisy = detectPitch(noise, SAMPLE_RATE, 0);

    expect(tonal!.clarity).toBeGreaterThan(0.9);
    expect(noisy!.clarity).toBeLessThan(0.4);
  });
});
