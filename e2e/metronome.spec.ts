import { chromium, expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE_URL } from '../playwright.config';

/**
 * The scheduling maths is unit-tested. This covers the part unit tests cannot:
 * that a real browser actually advances the beat lights, and that tempo and
 * transport respond.
 */

const PROFILE_ROOT = resolve('.e2e-profile');

async function openApp(name: string) {
  const profile = resolve(PROFILE_ROOT, name);
  mkdirSync(profile, { recursive: true });

  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  const page = await context.newPage();
  await page.goto(BASE_URL);
  return { context, page };
}

test('runs a 4/4 bar and lights every beat', async () => {
  const { context, page } = await openApp('metronome');

  const start = page.getByRole('button', { name: 'start' });
  await expect(start).toBeVisible();

  // Fast tempo, so a full bar passes quickly.
  const tempo = page.getByLabel('tempo');
  await tempo.fill('260');
  await expect(tempo).toHaveValue('260');

  await start.click();

  // Collect which beats light over a couple of bars.
  const seen = new Set<string>();
  const deadline = Date.now() + 6000;

  while (Date.now() < deadline && seen.size < 4) {
    const lit = await page.getAttribute('[data-lit="true"]', 'data-beat');
    if (lit !== null) seen.add(lit);
    await page.waitForTimeout(40);
  }

  expect([...seen].sort()).toEqual(['0', '1', '2', '3']);

  await context.close();
});

test('stops, and clears the beat lights', async () => {
  const { context, page } = await openApp('metronome-stop');

  await page.getByRole('button', { name: 'start' }).click();
  const stop = page.getByRole('button', { name: 'stop' });
  await expect(stop).toHaveAttribute('aria-pressed', 'true');

  await stop.click();

  await expect(page.getByRole('button', { name: 'start' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.locator('[data-lit="true"]')).toHaveCount(0);

  await context.close();
});

test('tempo is adjustable by keyboard and is clamped', async () => {
  const { context, page } = await openApp('metronome-tempo');

  const tempo = page.getByLabel('tempo');

  await tempo.fill('120');
  await expect(tempo).toHaveValue('120');

  // Typed values outside the range are pulled back to it, rather than being
  // accepted and then producing nonsense timing.
  await tempo.fill('5');
  await expect(tempo).toHaveValue('30');

  await tempo.fill('9000');
  await expect(tempo).toHaveValue('260');

  await context.close();
});
