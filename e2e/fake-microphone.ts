import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE_URL } from '../playwright.config';

/**
 * Replaces the microphone with a Web Audio oscillator at a known pitch.
 *
 * Chrome's own --use-file-for-fake-audio-capture was tried first and rejected:
 * it delivered the WAV so poorly that detection clarity sat at 0.2-0.3, which
 * tested Chrome's audio plumbing rather than this app. An injected stream is
 * exact and deterministic.
 *
 * What this does not cover is Chrome's real capture device. Everything above
 * it — getUserMedia, the analyser wiring, detection, note matching, and the
 * rendered result — is the real code path.
 */

/** Relative amplitudes of the first partials, roughly a bowed string. */
const HARMONICS = [1, 0.65, 0.45, 0.3, 0.2, 0.12];

const PROFILE_ROOT = resolve('.e2e-profile');

export async function openWithTone(
  frequency: number,
  profileName: string,
): Promise<{ context: BrowserContext; page: Page }> {
  // A persistent profile, so cookies, localStorage and IndexedDB survive
  // between runs instead of starting from a blank browser each time.
  const profile = resolve(PROFILE_ROOT, profileName);
  mkdirSync(profile, { recursive: true });

  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
  });

  await context.addInitScript(
    ([hz, harmonics]: [number, number[]]) => {
      navigator.mediaDevices.getUserMedia = async () => {
        const audio = new AudioContext();
        await audio.resume();
        const destination = audio.createMediaStreamDestination();

        const voices = harmonics.map((amplitude, index) => {
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = hz * (index + 1);
          gain.gain.value = amplitude * 0.15;
          oscillator.connect(gain);
          gain.connect(destination);
          oscillator.start();
          return gain;
        });

        // Stopping playing, on demand. Practice mode is about what the app
        // remembers *after* a note ends, which cannot be tested while the note
        // is still sounding.
        (window as unknown as { silence: () => void }).silence = () => {
          for (const gain of voices) gain.gain.value = 0;
        };

        return destination.stream;
      };
    },
    [frequency, HARMONICS] as [number, number[]],
  );

  await context.grantPermissions(['microphone'], { origin: BASE_URL });

  const page = await context.newPage();
  await page.goto(BASE_URL);
  return { context, page };
}

/** Cents above (positive) or below (negative) a reference frequency. */
export function detune(frequency: number, cents: number): number {
  return frequency * 2 ** (cents / 1200);
}
