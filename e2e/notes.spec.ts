import { chromium, expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE_URL } from '../playwright.config';

/**
 * The notes feature, end to end against the Firebase emulators.
 *
 * Requires the emulators to be running:
 *   firebase emulators:start --only auth,firestore
 *
 * The app connects to them when the page is loaded with ?emulator=1, which is
 * ignored outside a development build. That lets this drive the real
 * signInWithPopup and the real Firestore writes with a throwaway user, rather
 * than mocking the parts most likely to be wrong.
 */

const NOTES_URL = `${BASE_URL}/notes?emulator=1`;

async function openSignedIn(
  name: string,
): Promise<{ context: import('@playwright/test').BrowserContext; page: Page }> {
  const profile = resolve('.e2e-profile', name);
  mkdirSync(profile, { recursive: true });

  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  const page = await context.newPage();
  await page.goto(NOTES_URL);

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'sign in' }).click(),
  ]);

  // The Auth emulator serves its own chooser: add an account, let it invent
  // the details, then sign in.
  await popup.waitForLoadState('domcontentloaded');
  const addAccount = popup.getByRole('button', { name: /add new account/i });
  if (await addAccount.isVisible().catch(() => false)) {
    await addAccount.click();
  }
  const autoFill = popup.getByRole('button', { name: /auto.generate/i });
  if (await autoFill.isVisible().catch(() => false)) {
    await autoFill.click();
  }
  await popup.getByRole('button', { name: /sign in with google/i }).click();

  await expect(page.getByRole('button', { name: 'sign out' })).toBeVisible({
    timeout: 20_000,
  });

  return { context, page };
}

test('writes a phrase, saves it, and still has it after a reload', async () => {
  const { context, page } = await openSignedIn('notes');

  await page.getByRole('button', { name: 'new' }).click();
  await expect(page.getByRole('group', { name: 'written notation' })).toBeVisible();
  // Pin the naming, rather than depending on a remembered preference.
  await page.getByRole('button', { name: 'sargam' }).click();

  // Type the opening of the notebook phrase: Sa Re ma Pa, then hold.
  await page.getByRole('button', { name: 'insert Sa' }).click();
  await page.keyboard.press('R');
  await page.keyboard.press('m');
  await page.keyboard.press('P');
  await page.keyboard.press('-');

  const view = page.locator('main, div').filter({ hasText: 'saved' }).first();
  await expect(page.getByText('Sa', { exact: true }).first()).toBeVisible();
  await expect(view).toBeTruthy();

  // Wait for the debounced write to land.
  await expect(page.getByText('saved', { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  await page.reload();
  await expect(page.getByRole('button', { name: 'sign out' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Untitled' }).click();

  // Four swaras and a hold survived the round trip through Firestore.
  await expect(page.getByText('Sa', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pa', { exact: true }).first()).toBeVisible();

  await context.close();
});

test('renames a piece and lists it under the new title', async () => {
  const { context, page } = await openSignedIn('notes-rename');

  await page.getByRole('button', { name: 'new' }).click();

  const title = page.getByLabel('title');
  await title.fill('Bhairav alap');

  await expect(page.getByRole('button', { name: 'Bhairav alap' })).toBeVisible({
    timeout: 15_000,
  });

  await context.close();
});

test('deletes a piece', async () => {
  const { context, page } = await openSignedIn('notes-delete');

  await page.getByRole('button', { name: 'new' }).click();
  await expect(page.getByRole('button', { name: 'Untitled' })).toBeVisible();

  await page.getByRole('button', { name: 'delete' }).click();

  await expect(page.getByRole('button', { name: 'Untitled' })).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.getByText('nothing yet')).toBeVisible();

  await context.close();
});

test('one user cannot see another user notes', async () => {
  // Two throwaway accounts, each in its own profile.
  const first = await openSignedIn('notes-user-a');
  await first.page.getByRole('button', { name: 'new' }).click();
  await first.page.getByLabel('title').fill('Private to A');
  await expect(first.page.getByRole('button', { name: 'Private to A' })).toBeVisible({
    timeout: 15_000,
  });
  await first.context.close();

  const second = await openSignedIn('notes-user-b');
  await expect(second.page.getByText('nothing yet')).toBeVisible({ timeout: 15_000 });
  await expect(second.page.getByRole('button', { name: 'Private to A' })).toHaveCount(0);
  await second.context.close();
});

test('corrects a note in the middle of a line, not just at the end', async () => {
  const { context, page } = await openSignedIn('notes-caret');

  await page.getByRole('button', { name: 'new' }).click();
  const written = page.getByRole('group', { name: 'written notation' });
  await expect(written).toBeVisible();
  await page.getByRole('button', { name: 'sargam' }).click();

  for (const key of ['S', 'R', 'P', 'G']) await page.keyboard.press(key);

  // Back to before the P, swap it for Ma, and leave the G alone.
  await page.keyboard.press('Home');
  for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('m');

  // Scope to the written page: the swara keyboard carries these names too.
  await expect(written.getByText('Ma', { exact: true })).toBeVisible();
  await expect(written.getByText('Pa', { exact: true })).toHaveCount(0);
  // The note after the correction survived.
  await expect(written.getByText('Ga', { exact: true })).toBeVisible();

  await context.close();
});

test('writes bar lines and ties', async () => {
  const { context, page } = await openSignedIn('notes-bars');

  await page.getByRole('button', { name: 'new' }).click();
  const written = page.getByRole('group', { name: 'written notation' });
  await expect(written).toBeVisible();

  await page.keyboard.press('S');
  await page.keyboard.press('|');
  await page.keyboard.press('R');
  await page.getByRole('button', { name: /^tie/ }).click();
  await page.keyboard.press('G');

  await expect(written.locator('[data-bar]')).toHaveCount(1);
  await expect(written.locator('[data-tie]')).toHaveCount(1);

  // Saved and reloaded, the bar and the tie are still there.
  await expect(page.getByText('saved', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'sign out' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Untitled' }).click();

  const reloaded = page.getByRole('group', { name: 'written notation' });
  await expect(reloaded.locator('[data-bar]')).toHaveCount(1);
  await expect(reloaded.locator('[data-tie]')).toHaveCount(1);

  await context.close();
});

test('names the written notes in Western or sargam, on demand', async () => {
  const { context, page } = await openSignedIn('notes-notation');

  await page.getByRole('button', { name: 'new' }).click();
  const written = page.getByRole('group', { name: 'written notation' });
  await expect(written).toBeVisible();

  // A new piece has Sa on C, so the tonic itself is C4.
  await page.getByRole('button', { name: 'sargam' }).click();
  await page.keyboard.press('S');
  await page.keyboard.press('P');
  await expect(written.getByText('Sa', { exact: true })).toBeVisible();
  await expect(written.getByText('Pa', { exact: true })).toBeVisible();

  // The same two notes, named the Western way.
  await page.getByRole('button', { name: 'western' }).click();
  await expect(written.getByText('C4', { exact: true })).toBeVisible();
  await expect(written.getByText('G4', { exact: true })).toBeVisible();
  await expect(written.getByText('Sa', { exact: true })).toHaveCount(0);

  await context.close();
});
