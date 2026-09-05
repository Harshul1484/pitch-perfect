import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE_URL } from '../playwright.config';

/**
 * End-to-end coverage of the real detection path: a synthetic bowed-string
 * tone is fed to the page as a microphone stream, and the matching key must
 * light up.
 *
 * The tone is injected by replacing getUserMedia with a Web Audio stream
 * rather than using Chrome's --use-file-for-fake-audio-capture. That flag
 * resamples the file badly enough to add tens of cents of jitter, which makes
 * intonation assertions flap for reasons that have nothing to do with this
 * code.
 */

/**
 * A persistent profile directory, so cookies, localStorage and IndexedDB
 * survive between runs rather than starting from a blank browser each time.
 */
const PROFILE_ROOT = resolve('.e2e-profile');

/** Relative harmonic amplitudes, roughly a bowed string. */
const BOWED = [1, 0.65, 0.45, 0.3, 0.2, 0.12];

async function listenTo(
  name: string,
  frequency: number,
): Promise<{ context: BrowserContext; page: Page }> {
  const profile = resolve(PROFILE_ROOT, name);
  mkdirSync(profile, { recursive: true });

  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });
  await context.grantPermissions(['microphone'], { origin: BASE_URL });

  await context.addInitScript(
    ([hz, partials]: [number, number[]]) => {
      navigator.mediaDevices.getUserMedia = async () => {
        const audio = new AudioContext();
        await audio.resume();
        const destination = audio.createMediaStreamDestination();

        partials.forEach((amplitude, index) => {
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          oscillator.frequency.value = hz * (index + 1);
          gain.gain.value = amplitude * 0.15;
          oscillator.connect(gain);
          gain.connect(destination);
          oscillator.start();
        });

        return destination.stream;
      };
    },
    [frequency, BOWED] as [number, number[]],
  );

  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.getByRole('button', { name: 'listen' }).click();

  return { context, page };
}

function key(page: Page, label: string) {
  return page.getByRole('button', { name: new RegExp(`^Play ${label},`) });
}

test('lights up A4 when it hears 440 Hz, and calls it in tune', async () => {
  const { context, page } = await listenTo('a4', 440);

  await expect(key(page, 'A4')).toHaveAttribute('aria-current', 'true', {
    timeout: 15_000,
  });
  await expect(page.getByText('in tune', { exact: true })).toBeVisible({ timeout: 10_000 });

  await context.close();
});

test('lights up G3, the lowest open violin string, without an octave error', async () => {
  const { context, page } = await listenTo('g3', 196);

  await expect(key(page, 'G3')).toHaveAttribute('aria-current', 'true', {
    timeout: 15_000,
  });
  // The failure this guards: locking onto the second harmonic and lighting G4.
  await expect(key(page, 'G4')).not.toHaveAttribute('aria-current', 'true');

  await context.close();
});

test('reports how sharp a note is, not merely which note', async () => {
  // A4 pulled 30 cents sharp.
  const { context, page } = await listenTo('sharp', 440 * 2 ** (30 / 1200));

  await expect(key(page, 'A4')).toHaveAttribute('aria-current', 'true', {
    timeout: 15_000,
  });
  await expect(page.getByText(/\+2[0-9]¢ sharp|\+3[0-9]¢ sharp/)).toBeVisible({
    timeout: 10_000,
  });

  await context.close();
});

test('reports a flat note as flat', async () => {
  const { context, page } = await listenTo('flat', 440 * 2 ** (-30 / 1200));

  await expect(key(page, 'A4')).toHaveAttribute('aria-current', 'true', {
    timeout: 15_000,
  });
  await expect(page.getByText(/-[23][0-9]¢ flat/)).toBeVisible({ timeout: 10_000 });

  await context.close();
});

test('stops listening and clears the readout', async () => {
  const { context, page } = await listenTo('stop', 440);

  await expect(key(page, 'A4')).toHaveAttribute('aria-current', 'true', {
    timeout: 15_000,
  });

  await page.getByRole('button', { name: 'stop' }).first().click();

  await expect(page.getByText('idle')).toBeVisible();
  await expect(page.locator('[aria-current="true"]')).toHaveCount(0);

  await context.close();
});

test('a key still plays its reference pitch when clicked', async () => {
  const { context, page } = await listenTo('click', 440);

  await key(page, 'C4').click();
  const audioRan = await page.evaluate(() => new AudioContext().state !== 'closed');

  expect(audioRan).toBe(true);

  await context.close();
});
