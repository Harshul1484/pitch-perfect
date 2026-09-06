import { chromium, expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE_URL } from '../playwright.config';

/** Sargam is relative, so the visible names must follow the chosen Sa. */

async function openApp(name: string) {
  const profile = resolve('.e2e-profile', name);
  mkdirSync(profile, { recursive: true });

  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await context.newPage();
  await page.goto(BASE_URL);
  return { context, page };
}

/** Notation moved into the controls, so reaching it means opening them. */
async function chooseNotation(page: Page, notation: 'western' | 'sargam') {
  const controls = page.getByRole('button', { name: 'controls' });
  if (await controls.isVisible()) await controls.click();

  await page
    .getByRole('group', { name: 'notation' })
    .getByRole('button', { name: notation, exact: true })
    .click();

  if (await controls.isVisible()) await page.keyboard.press('Escape');
}

test('switches between Western and sargam naming', async () => {
  const { context, page } = await openApp('notation');

  // Western by default.
  await expect(page.getByRole('button', { name: /^Play C4,/ })).toBeVisible();

  await chooseNotation(page, 'sargam');

  // With Sa on C, middle C is Sa and F sharp is tivra Ma.
  await expect(page.getByRole('button', { name: /^Play Sa, C4,/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Play tivra Ma, F♯4,/ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Play komal Re, C♯4,/ })).toBeVisible();

  await chooseNotation(page, 'western');
  await expect(page.getByRole('button', { name: /^Play C4,/ })).toBeVisible();

  await context.close();
});

test('moving Sa renames every key', async () => {
  const { context, page } = await openApp('notation-tonic');

  await chooseNotation(page, 'sargam');
  // Sa on D, the scordatura case that motivated a movable tonic. The tonic
  // lives in the controls popover now.
  await page.getByRole('button', { name: 'controls' }).click();
  await page.getByLabel('tonic').selectOption('2');
  await page.keyboard.press('Escape');

  await expect(page.getByRole('button', { name: /^Play Sa, D4,/ })).toBeVisible();
  // C is now komal Ni rather than Sa.
  await expect(page.getByRole('button', { name: /^Play komal Ni, C4,/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Play Pa, A4,/ })).toBeVisible();

  await context.close();
});
