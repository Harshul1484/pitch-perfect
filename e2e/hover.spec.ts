import { expect, test } from '@playwright/test';
import { BASE_URL } from '../playwright.config';
import { expectStaysDark } from './cap';

/**
 * A control that is on must stay on under the pointer.
 *
 * This is not a matter of taste. `hover:bg-white` and `hover:bg-graphite` carry
 * the same specificity, so whichever Tailwind happens to emit last wins — and
 * it emits white last. Any pressed cap that also carried the plain hover was
 * therefore repainted white on hover, and since a pressed cap's label is
 * near-white, the label vanished with it.
 *
 * The fix is that hover styling lives on the off state and never travels with
 * the on state. These tests hold that line by reading the colours the browser
 * actually computed, which is the only thing that settles a cascade question.
 */

test('the notation switch keeps its selected cap dark under the pointer', async ({
  page,
}) => {
  await page.goto(BASE_URL);

  const sargam = page.getByRole('button', { name: 'sargam', exact: true });
  await sargam.click();

  await expectStaysDark(sargam, 'the selected notation');
});

test('the metronome keeps its running button dark under the pointer', async ({ page }) => {
  await page.goto(BASE_URL);

  const start = page.getByRole('button', { name: 'start', exact: true });
  await start.click();

  const stop = page.getByRole('button', { name: 'stop', exact: true });
  await expectStaysDark(stop, 'the running metronome');
});

test('the drone keeps its on button dark under the pointer', async ({ page }) => {
  await page.goto(BASE_URL);

  await page.getByRole('button', { name: 'controls' }).click();
  const drone = page.getByRole('button', { name: 'drone' });
  await drone.click();

  await expectStaysDark(drone, 'the drone');
});

/**
 * Every cap in the app that can be on, listed by where it lives, so a new one
 * added without this discipline shows up here rather than in a screenshot.
 */
test('no cap carries both hover backgrounds at once', async ({ page }) => {
  await page.goto(BASE_URL);

  // Turn everything on first. The conflicting class only appears on the on
  // state, so scanning a page of idle controls would find nothing and say so.
  await page.getByRole('button', { name: 'sargam', exact: true }).click();
  await page.getByRole('button', { name: 'start', exact: true }).click();
  await page.getByRole('button', { name: 'controls' }).click();
  await page.getByRole('button', { name: 'drone' }).click();

  const offenders = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a'))
      .filter((el) => {
        const cls = el.className.toString();
        return cls.includes('hover:bg-white') && cls.includes('hover:bg-graphite');
      })
      .map((el) => (el.textContent ?? '').trim().slice(0, 30)),
  );

  expect(offenders, offenders.join(', ')).toEqual([]);
});
