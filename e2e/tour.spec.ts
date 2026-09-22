import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE_URL } from '../playwright.config';

/**
 * The walkthroughs, driven the way a newcomer meets them.
 *
 * Three things matter and none of them can be checked without a browser: the
 * offer appears on a first visit and never again, the panel does not sit on
 * top of the thing it is pointing at, and the notebook's tour can ask for a
 * piece that does not exist yet and keep going once it does. The geometry
 * underneath is unit-tested in src/lib/tour.test.ts; this is about whether it
 * is wired to the real page.
 */

/** A profile of its own, so a first visit is actually a first visit. */
async function open(name: string): Promise<{ context: BrowserContext; page: Page }> {
  const profile = resolve('.e2e-profile', name);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  mkdirSync(profile, { recursive: true });

  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  return { context, page };
}

/**
 * Settled enough to measure.
 *
 * The panel's height is the height of its words, so anything measured while
 * the mono face is still loading is measuring different words to the ones
 * that end up on screen.
 */
async function ready(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Sign in through the Auth emulator's own chooser.
 *
 * Every step is waited for rather than sampled: asking `isVisible()` the
 * instant the document loads answers about a page the emulator has not drawn
 * yet, which skips the chooser and leaves the popup on a screen with no
 * button to click — a hang rather than a failure.
 */
async function signIn(page: Page) {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: /continue with google/i }).click(),
  ]);

  await popup.waitForLoadState('domcontentloaded');

  const addAccount = popup.getByRole('button', { name: /add new account/i });
  const signIn = popup.getByRole('button', { name: /sign in with google/i });
  await expect(addAccount.or(signIn).first()).toBeVisible({ timeout: 20_000 });

  if (await addAccount.isVisible()) {
    await addAccount.click();
    const autoFill = popup.getByRole('button', { name: /auto.generate/i });
    await expect(autoFill).toBeVisible({ timeout: 15_000 });
    await autoFill.click();
  }

  await signIn.click();
  await expect(page.locator('[data-account]')).toBeVisible({ timeout: 20_000 });
}

/**
 * What the spotlight is on, measured against where the panel landed.
 *
 * A step whose target fills the window — the key bed does — has nowhere for
 * the panel to go but over it, so overlap is only counted as a fault when
 * there was somewhere else to put it.
 */
async function lit(page: Page) {
  return page.evaluate(async () => {
    // The panel measures itself and then moves, so a reading taken the
    // instant a step comes up can be of a panel that has not landed yet.
    await new Promise((settle) =>
      requestAnimationFrame(() => requestAnimationFrame(settle)),
    );

    const ring = [...document.querySelectorAll('div')].find((node) =>
      node.className.includes('border-signal'),
    );
    if (!ring) return null;

    const target = ring.getBoundingClientRect();
    const panel = document.querySelector('[role="dialog"]')!.getBoundingClientRect();
    const fills =
      target.width * target.height > window.innerWidth * window.innerHeight * 0.4;

    return {
      // Carried into the failure message: an overlap of a few pixels is
      // impossible to argue about from a screenshot and obvious from the
      // two rectangles.
      where: JSON.stringify({ target, panel }),
      sized: target.width > 0 && target.height > 0,
      covered:
        !fills &&
        panel.left < target.right &&
        panel.right > target.left &&
        panel.top < target.bottom &&
        panel.bottom > target.top,
    };
  });
}

test('the tuner tour points at real things, and is offered only once', async () => {
  const { context, page } = await open('tour-tuner');
  await page.goto(BASE_URL);
  await ready(page);

  await expect(page.getByText('First time here?')).toBeVisible();
  await page.getByRole('button', { name: 'show me around' }).click();

  const panel = page.getByRole('dialog');
  for (let step = 1; step <= 6; step += 1) {
    await expect(panel).toContainText(`${step} of 6`);

    const spot = await lit(page);
    if (spot) {
      expect(spot.sized, `step ${step} lights nothing`).toBe(true);
      expect(spot.covered, `step ${step} panel covers its own target ${spot.where}`).toBe(
        false,
      );
    }

    if (step < 6) await page.getByRole('button', { name: 'next' }).click();
  }

  await page.getByRole('button', { name: 'done' }).click();
  await expect(panel).toHaveCount(0);

  // The whole point of remembering: it does not greet you twice.
  await page.reload();
  await expect(page.getByText('First time here?')).toHaveCount(0);

  await context.close();
});

test('the notebook tour asks for a piece, then talks about it', async () => {
  test.setTimeout(120_000);

  const { context, page } = await open('tour-notes');
  await page.goto(`${BASE_URL}/notes?emulator=1`);
  await signIn(page);
  await ready(page);

  await expect(page.getByText('First time here?')).toBeVisible();
  await page.getByRole('button', { name: 'show me around' }).click();

  // It opens on an empty notebook, so it asks for a piece rather than
  // explaining an editor that is not on the page yet.
  const panel = page.getByRole('dialog');
  await expect(panel).toContainText('1 of 5');
  await expect(panel).toContainText('Start a piece');

  // Pressing the thing it asked for is how that step is finished.
  await page.getByRole('button', { name: 'new', exact: true }).click();
  await expect(panel).toContainText('2 of 5');
  await expect(page.getByRole('group', { name: 'written notation' })).toBeVisible();

  for (const step of [3, 4, 5]) {
    await page.getByRole('button', { name: 'next' }).click();
    await expect(panel).toContainText(`${step} of 5`);

    const spot = await lit(page);
    expect(spot?.sized, `notebook step ${step} lights nothing`).toBe(true);
    expect(spot?.covered, `notebook step ${step} panel covers its own target`).toBe(
      false,
    );
  }

  await page.getByRole('button', { name: 'done' }).click();
  await expect(panel).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('First time here?')).toHaveCount(0);

  await context.close();
});
