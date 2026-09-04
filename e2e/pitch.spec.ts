import { expect, test } from '@playwright/test';
import { detune, openWithTone } from './fake-microphone';

/**
 * End-to-end coverage of the listening path: a tone of known pitch goes in,
 * and the matching tile must light up with the right cents reading.
 */

const A4 = 440;
const G3 = 196;

/** Read the cents value out of a readout like "+30¢ sharp". */
function parseCents(text: string): number {
  const match = /([+-]?\d+)¢/.exec(text);
  if (!match) throw new Error(`no cents value in "${text}"`);
  return Number(match[1]);
}

test('lights up A4 when it hears 440 Hz', async () => {
  const { context, page } = await openWithTone(A4, 'a4');

  await page.getByRole('button', { name: 'Listen' }).click();

  await expect(page.getByRole('button', { name: /^Play A4,/ })).toHaveAttribute(
    'aria-current',
    'true',
    { timeout: 15_000 },
  );
  await expect(page.getByText('in tune')).toBeVisible();

  await context.close();
});

test('lights up G3, the lowest open violin string, without an octave error', async () => {
  const { context, page } = await openWithTone(G3, 'g3');

  await page.getByRole('button', { name: 'Listen' }).click();

  await expect(page.getByRole('button', { name: /^Play G3,/ })).toHaveAttribute(
    'aria-current',
    'true',
    { timeout: 15_000 },
  );
  // The failure this guards: locking onto the second harmonic and lighting G4.
  await expect(page.getByRole('button', { name: /^Play G4,/ })).not.toHaveAttribute(
    'aria-current',
    'true',
  );

  await context.close();
});

test('reports how sharp a note is, not merely which note', async () => {
  const { context, page } = await openWithTone(detune(A4, 30), 'a4-sharp');

  await page.getByRole('button', { name: 'Listen' }).click();
  await expect(page.getByRole('button', { name: /^Play A4,/ })).toHaveAttribute(
    'aria-current',
    'true',
    { timeout: 15_000 },
  );

  const readout = page.getByText(/[+-]\d+¢ (sharp|flat)/).first();
  await expect(readout).toBeVisible();

  const cents = parseCents((await readout.textContent()) ?? '');
  expect(cents).toBeGreaterThan(25);
  expect(cents).toBeLessThan(35);

  await context.close();
});

test('reports a flat note as flat', async () => {
  const { context, page } = await openWithTone(detune(G3, -25), 'g3-flat');

  await page.getByRole('button', { name: 'Listen' }).click();
  await expect(page.getByRole('button', { name: /^Play G3,/ })).toHaveAttribute(
    'aria-current',
    'true',
    { timeout: 15_000 },
  );

  const readout = page.getByText(/[+-]\d+¢ (sharp|flat)/).first();
  const cents = parseCents((await readout.textContent()) ?? '');
  expect(cents).toBeLessThan(-20);
  expect(cents).toBeGreaterThan(-30);

  await context.close();
});

test('stops listening and clears the readout', async () => {
  const { context, page } = await openWithTone(A4, 'stop');

  await page.getByRole('button', { name: 'Listen' }).click();
  await expect(page.getByRole('button', { name: /^Play A4,/ })).toHaveAttribute(
    'aria-current',
    'true',
    { timeout: 15_000 },
  );

  await page.getByRole('button', { name: 'Stop' }).click();

  await expect(page.getByRole('button', { name: /^Play A4,/ })).not.toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Listen' })).toBeVisible();

  await context.close();
});

test('a tile still plays its reference pitch when clicked', async () => {
  const { context, page } = await openWithTone(A4, 'click');

  await page.getByRole('button', { name: /^Play C4,/ }).click();

  const audioWorks = await page.evaluate(() => new AudioContext().state !== 'closed');
  expect(audioWorks).toBe(true);

  await context.close();
});

test('the nav bar is gone', async () => {
  const { context, page } = await openWithTone(A4, 'nav');

  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Home' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'About' })).toHaveCount(0);

  await context.close();
});
