import { chromium, expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE_URL } from '../playwright.config';

/**
 * The drone is audio, which a screenshot cannot prove. These tests count the
 * oscillators the page actually builds, so a button that toggles its own state
 * while making no sound would fail.
 */

async function openApp(name: string) {
  const profile = resolve('.e2e-profile', name);
  mkdirSync(profile, { recursive: true });

  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  // Count oscillator construction and note the frequencies asked for.
  await context.addInitScript(() => {
    const started: number[] = [];
    (window as unknown as { __osc: number[] }).__osc = started;

    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function patched() {
      const oscillator = create.call(this);
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (when?: number) => {
        started.push(oscillator.frequency.value);
        start(when);
      };
      return oscillator;
    };
  });

  const page = await context.newPage();
  await page.goto(BASE_URL);
  // Tonic and the drone live in the controls popover now.
  await page.getByRole('button', { name: 'controls' }).click();
  return { context, page };
}

const oscillators = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __osc: number[] }).__osc);

test('sounds a tonic, fifth and octave, and stops', async () => {
  const { context, page } = await openApp('drone');

  const drone = page.getByRole('button', { name: 'drone' });
  await expect(drone).toHaveAttribute('aria-pressed', 'false');
  expect(await oscillators(page)).toHaveLength(0);

  await drone.click();
  await expect(drone).toHaveAttribute('aria-pressed', 'true');

  await expect.poll(async () => (await oscillators(page)).length).toBe(3);

  // Sa on C in octave 3 is 130.81 Hz; then its fifth and its octave.
  const [root, fifth, octave] = await oscillators(page);
  expect(root).toBeCloseTo(130.81, 1);
  expect(fifth / root).toBeCloseTo(1.5, 3);
  expect(octave / root).toBeCloseTo(2, 3);

  await drone.click();
  await expect(drone).toHaveAttribute('aria-pressed', 'false');

  await context.close();
});

test('retunes with the tonic instead of restarting', async () => {
  const { context, page } = await openApp('drone-tonic');

  await page.getByRole('button', { name: 'drone' }).click();
  await expect.poll(async () => (await oscillators(page)).length).toBe(3);

  // Moving the tonic must not build a second set of oscillators.
  await page.getByLabel('tonic').selectOption('2');
  await page.waitForTimeout(400);

  expect(await oscillators(page)).toHaveLength(3);

  await context.close();
});

test('the tonic is reachable in Western notation too', async () => {
  const { context, page } = await openApp('drone-western');

  // It used to be hidden outside sargam, where it is also the drone's root.
  await expect(page.getByRole('button', { name: 'western' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('tonic')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'controls' })).toBeVisible();

  await context.close();
});
