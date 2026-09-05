import { chromium, expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE_URL } from '../playwright.config';
import { audit, expectNothingCutOff } from './audit';

/**
 * Quick Record, end to end.
 *
 * A phrase is fed to the page as a microphone stream and the review must
 * report the right notes and the right intonation. The frequencies are chosen
 * so the expected cents are known exactly:
 *
 *   440 Hz is A4 dead on
 *   500 Hz is B4 (493.88) about +21 cents
 *   553 Hz is C sharp 5 (554.37) about -4 cents
 */
const PHRASE = [440, 440, 500, 500, 553, 553, 440];

async function record(
  name: string,
  seconds: number,
  screen?: { width: number; height: number },
) {
  const profile = resolve('.e2e-profile', name);
  mkdirSync(profile, { recursive: true });

  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    ...(screen ? { viewport: screen, hasTouch: true, isMobile: true } : {}),
  });
  await context.grantPermissions(['microphone'], { origin: BASE_URL });

  await context.addInitScript((steps: number[]) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const audio = new AudioContext();
      await audio.resume();
      const destination = audio.createMediaStreamDestination();

      const voices = [1, 0.65, 0.45, 0.3].map((amplitude, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        gain.gain.value = amplitude * 0.15;
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start();
        return { oscillator, partial: index + 1 };
      });

      let step = 0;
      setInterval(() => {
        const frequency = steps[step % steps.length];
        step += 1;
        for (const { oscillator, partial } of voices) {
          oscillator.frequency.setValueAtTime(frequency * partial, audio.currentTime);
        }
      }, 700);

      return destination.stream;
    };
  }, PHRASE);

  const page = await context.newPage();
  await page.goto(BASE_URL);

  await page.getByRole('button', { name: 'listen' }).click();
  await page.waitForTimeout(900);

  await page.getByRole('button', { name: 'record' }).click();
  await page.waitForTimeout(seconds * 1000);
  // While running the button shows the clock instead of a label.
  await page.getByRole('button', { name: /^\d:\d\d$/ }).click();

  return { context, page };
}

test('records a phrase and reports what was played, in tune or not', async () => {
  const { context, page } = await record('recording', 4.2);

  // Scope to the review: the key bed carries these note names too.
  const review = page.getByRole('group', { name: 'recording review' });
  await expect(review).toBeVisible();

  // Every note of the phrase is listed, named correctly.
  await expect(review.getByText('B4', { exact: true })).toBeVisible();
  await expect(review.getByText('C♯5', { exact: true })).toBeVisible();

  // B4 was fed 21 cents sharp, so it must be named as the worst of the run.
  await expect(review.getByText(/furthest out: B4/)).toBeVisible();
  await expect(review.getByText(/\+2[01]/).first()).toBeVisible();

  await context.close();
});

test('offers no save when signed out, and can be discarded', async () => {
  const { context, page } = await record('recording-discard', 2.4);

  await expect(page.getByText(/Sign in to save/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'save to notes' })).toHaveCount(0);

  await page.getByRole('button', { name: 'discard' }).click();
  await expect(page.getByText(/Sign in to save/i)).toHaveCount(0);

  await context.close();
});

test('cannot record while the microphone is closed', async () => {
  const profile = resolve('.e2e-profile', 'recording-idle');
  mkdirSync(profile, { recursive: true });

  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await context.newPage();
  await page.goto(BASE_URL);

  // Recording nothing would look like it worked and then review as empty.
  await expect(page.getByRole('button', { name: 'record' })).toBeDisabled();

  await context.close();
});

/**
 * The review is a panel hanging off the header, and on a phone there is far
 * less below the header for it to hang into.
 */
for (const screen of [
  { name: 'small android', width: 640, height: 360 },
  { name: 'iphone 14', width: 844, height: 390 },
]) {
  test(`reviews a recording on a ${screen.name} without running off the screen`, async () => {
    const { context, page } = await record(`recording-${screen.width}`, 4.2, screen);

    const review = page.getByRole('group', { name: 'recording review' });
    await expect(review).toBeVisible();
    await expect(review.getByText('B4', { exact: true })).toBeVisible();

    expectNothingCutOff(await audit(page));

    await context.close();
  });
}
