import { expect, test } from '@playwright/test';
import { BASE_URL } from '../playwright.config';

/**
 * What the instruments actually sound like.
 *
 * Timbre normally can only be judged by ear, which no test can do. But the
 * things that make a bowed note a bowed note — a gradual attack, a level
 * sustain, and vibrato — are all measurable. Each voice is rendered into an
 * OfflineAudioContext and the samples are examined directly.
 *
 * The app's own audio module is imported into the page, so this measures the
 * shipping code rather than a copy of it.
 */

interface Measured {
  peak: number;
  rms10: number;
  rms50: number;
  rms300: number;
  rms700: number;
  zcr: number[];
}

async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    // A runtime URL served by the dev server, not a module the compiler can
    // resolve, so it goes through a variable and is typed at the call site.
    type AudioModule = {
      buildVoice: (
        ctx: BaseAudioContext,
        destination: AudioNode,
        voice: 'violin' | 'piano',
        frequency: number,
        startedAt: number,
        duration: number,
        volume: number,
      ) => void;
    };
    const url = '/src/lib/audio.ts';
    const audio = (await import(/* @vite-ignore */ url)) as AudioModule;
    const rate = 44100;
    const duration = 1;

    const rms = (data: Float32Array, from: number, to: number) => {
      let sum = 0;
      const first = Math.floor(from * rate);
      const last = Math.min(Math.floor(to * rate), data.length);
      for (let i = first; i < last; i += 1) sum += data[i] * data[i];
      return Math.sqrt(sum / Math.max(1, last - first));
    };

    /** Zero crossings per second: it moves when the pitch does. */
    const zcr = (data: Float32Array, from: number, to: number) => {
      let crossings = 0;
      const first = Math.floor(from * rate);
      const last = Math.min(Math.floor(to * rate), data.length);
      for (let i = first + 1; i < last; i += 1) {
        if (data[i - 1] < 0 !== data[i] < 0) crossings += 1;
      }
      return Math.round(crossings / (to - from));
    };

    const out: Record<string, unknown> = {};

    for (const voice of ['violin', 'piano'] as const) {
      const ctx = new OfflineAudioContext(1, Math.ceil(rate * (duration + 0.2)), rate);
      audio.buildVoice(ctx, ctx.destination, voice, 440, 0, duration, 1);
      const data = (await ctx.startRendering()).getChannelData(0);

      let peak = 0;
      for (const sample of data) peak = Math.max(peak, Math.abs(sample));

      out[voice] = {
        peak,
        rms10: rms(data, 0, 0.01),
        rms50: rms(data, 0.04, 0.06),
        rms300: rms(data, 0.29, 0.31),
        rms700: rms(data, 0.69, 0.71),
        zcr: [0.35, 0.45, 0.55, 0.65, 0.75].map((at) => zcr(data, at, at + 0.08)),
      };
    }

    return out as { violin: Measured; piano: Measured };
  });
}

test('the violin is bowed and the piano is struck', async ({ page }) => {
  await page.goto(BASE_URL);
  const { violin, piano } = await measure(page);

  // The bow takes hold: nearly silent at 10ms, part way up at 50ms of a 90ms
  // attack, and only at full level later.
  expect(violin.rms10).toBeLessThan(0.02);
  expect(violin.rms50).toBeGreaterThan(0.02);
  expect(violin.rms50).toBeLessThan(violin.rms300 * 0.8);

  // And then it holds, rather than dying away.
  expect(violin.rms700).toBeGreaterThan(violin.rms300 * 0.9);

  // The piano is at full level almost at once, and then decays throughout.
  expect(piano.rms50).toBeGreaterThan(0.09);
  expect(piano.rms300).toBeLessThan(piano.rms50 * 0.3);
  expect(piano.rms700).toBeLessThan(piano.rms300 * 0.3);
});

test('the violin has vibrato and the piano does not', async ({ page }) => {
  await page.goto(BASE_URL);
  const { violin, piano } = await measure(page);

  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

  // Vibrato moves the pitch, so the crossing rate moves with it.
  expect(spread(violin.zcr)).toBeGreaterThan(4);
  // A struck note holds one pitch.
  expect(spread(piano.zcr)).toBeLessThanOrEqual(2);
});

test('both voices stay within a sane level', async ({ page }) => {
  await page.goto(BASE_URL);
  const { violin, piano } = await measure(page);

  // Well clear of clipping, and audible.
  for (const voice of [violin, piano]) {
    expect(voice.peak).toBeGreaterThan(0.05);
    expect(voice.peak).toBeLessThan(0.9);
  }
});
