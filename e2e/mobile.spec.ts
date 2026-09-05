import { expect, test } from '@playwright/test';
import { BASE_URL } from '../playwright.config';
import { audit, expectNothingCutOff } from './audit';

/**
 * The app on a phone.
 *
 * Two things are checked, at every phone size worth caring about:
 *
 *  1. Held upright, the page turns itself a quarter turn, so the instrument is
 *     always read in landscape.
 *  2. Nothing is cut off. That is not judged by eye — the page is walked and
 *     every element is measured against the frame it sits in, and every box
 *     that clips its overflow is checked against the content inside it.
 *
 * Screen sizes are the CSS pixel sizes of common phones lying on their side.
 */
const PHONES = [
  { name: 'small android', width: 640, height: 360 },
  { name: 'iphone se', width: 667, height: 375 },
  { name: 'iphone 14', width: 844, height: 390 },
  { name: 'pixel 7', width: 915, height: 412 },
] as const;

for (const phone of PHONES) {
  test.describe(`${phone.name} (${phone.width}x${phone.height})`, () => {
    test.use({
      viewport: { width: phone.width, height: phone.height },
      hasTouch: true,
      isMobile: true,
    });

    test('the tuner fits on the screen', async ({ page }) => {
      await page.goto(BASE_URL);
      await expect(page.getByRole('button', { name: 'listen' })).toBeVisible();

      const result = await audit(page);
      expect(result.frame.width).toBeGreaterThanOrEqual(phone.width - 2);
      expectNothingCutOff(result);
    });

    test('every key of the bed is reachable', async ({ page }) => {
      await page.goto(BASE_URL);

      const keys = page.getByRole('button', { name: /^Play / });
      await expect(keys).toHaveCount(88);

      // The corners of the plate: the lowest and highest notes, which are the
      // ones a squeezed layout loses first.
      for (const name of [/^Play A0/, /^Play C8/]) {
        const key = page.getByRole('button', { name });
        const rect = await key.boundingBox();
        expect(rect, `${String(name)} has no box`).not.toBeNull();
        expect(rect!.x).toBeGreaterThanOrEqual(-1);
        expect(rect!.y).toBeGreaterThanOrEqual(-1);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(phone.width + 1);
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(phone.height + 1);
        // Still big enough to hit with a finger.
        expect(rect!.height).toBeGreaterThan(18);
        expect(rect!.width).toBeGreaterThan(18);
      }
    });

    test('the controls panel opens without falling off the screen', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('button', { name: 'controls' }).click();
      await expect(page.getByRole('dialog', { name: 'controls' })).toBeVisible();

      expectNothingCutOff(await audit(page));
    });

    test('a microphone failure reports itself without shoving anything out', async ({
      page,
    }) => {
      // No microphone in this browser, so asking for one fails and the tuner
      // has an error to show. That message is extra height in an already full
      // column, which is exactly the case a fixed layout gets wrong.
      await page.goto(BASE_URL);
      await page.getByRole('button', { name: 'listen' }).click();
      await expect(page.getByRole('alert')).toBeVisible();

      expectNothingCutOff(await audit(page));
    });

    test('the notes page fits on the screen', async ({ page }) => {
      await page.goto(`${BASE_URL}/notes`);
      await expect(page.getByRole('heading', { name: 'notes', exact: true })).toBeVisible();

      expectNothingCutOff(await audit(page));
    });
  });
}

test.describe('held upright', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a phone in portrait gets the page turned on its side', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('button', { name: 'listen' })).toBeVisible();

    const frame = await page.evaluate(() => {
      const root = document.getElementById('root')!;
      const box = root.getBoundingClientRect();
      return {
        // The layout box, in its own coordinates: landscape.
        laidOut: { width: root.offsetWidth, height: root.offsetHeight },
        // Where it lands on the screen: over the whole portrait viewport.
        onScreen: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
        coarse: window.matchMedia('(pointer: coarse)').matches,
      };
    });

    expect(frame.coarse, 'the rotation is gated on a touch device').toBe(true);
    expect(frame.laidOut.width).toBeGreaterThan(frame.laidOut.height);
    expect(frame.onScreen).toEqual({ x: 0, y: 0, width: 390, height: 844 });

    expectNothingCutOff(await audit(page));
  });

  test('an upright desktop window of the same shape is left alone', async ({
    browser,
  }) => {
    // Same portrait viewport, but a mouse: this is a narrow window, not a phone.
    // The touch options are turned off explicitly, because a context made from
    // the browser fixture inherits whatever test.use set.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: false,
      isMobile: false,
    });
    const page = await context.newPage();
    await page.goto(BASE_URL);
    await expect(page.getByRole('button', { name: 'listen' })).toBeVisible();

    const rotated = await page.evaluate(
      () => getComputedStyle(document.getElementById('root')!).transform !== 'none',
    );
    expect(rotated).toBe(false);

    await context.close();
  });
});
