import { chromium, expect, test, type Page } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE_URL } from '../playwright.config';
import { audit, expectNothingCutOff } from './audit';
import { expectStaysDark } from './cap';
import { parseNotation } from '../src/lib/composition';
import { scoreFromLines } from '../src/lib/musicxml';

/**
 * The notes feature, end to end against the Firebase emulators.
 *
 * Requires the emulators to be running:
 *   firebase emulators:start --project <projectId>
 *
 * The app connects to them when the page is loaded with ?emulator=1, which is
 * ignored outside a development build. That lets this drive the real
 * signInWithPopup and the real Firestore writes with a throwaway user, rather
 * than mocking the parts most likely to be wrong.
 */

const NOTES_URL = `${BASE_URL}/notes?emulator=1`;

async function openSignedIn(
  name: string,
  screen?: { width: number; height: number },
  /** Inject a microphone playing this pitch, for practising. */
  hz?: number,
  /**
   * The notation to open in. There is no switch on this page any more — it is
   * one setting for the whole app, set on the tuner — so a test that wants
   * sargam seeds the preference the page reads.
   */
  notation?: 'western' | 'sargam',
  /** Extra query parameters, for the development-only seams the app offers. */
  query = '',
): Promise<{ context: import('@playwright/test').BrowserContext; page: Page }> {
  // A fresh profile every run. These tests sign in, so a profile left over
  // from last time comes back already signed in — and then the sign-in button
  // this waits for never appears. The session still persists within a run,
  // which is what the reload tests need.
  const profile = resolve('.e2e-profile', name);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });

  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    args: [
      '--autoplay-policy=no-user-gesture-required',
      ...(hz ? ['--use-fake-ui-for-media-stream'] : []),
    ],
    ...(screen ? { viewport: screen, hasTouch: true, isMobile: true } : {}),
  });

  if (hz) {
    await context.grantPermissions(['microphone'], { origin: BASE_URL });
    await context.addInitScript((frequency: number) => {
      navigator.mediaDevices.getUserMedia = async () => {
        const audio = new AudioContext();
        await audio.resume();
        const destination = audio.createMediaStreamDestination();

        // A few partials, so the detector sees a string rather than a sine.
        [1, 0.65, 0.45, 0.3].forEach((amplitude, index) => {
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          oscillator.frequency.value = frequency * (index + 1);
          gain.gain.value = amplitude * 0.15;
          oscillator.connect(gain);
          gain.connect(destination);
          oscillator.start();
        });

        return destination.stream;
      };
    }, hz);
  }

  if (notation) {
    // Seed only when unset. This script runs on every load, reloads included,
    // so setting it unconditionally would overwrite a change made mid-test and
    // silently undo the very switch the test is checking.
    await context.addInitScript((value: string) => {
      if (window.localStorage.getItem('pitch.notation') === null) {
        window.localStorage.setItem('pitch.notation', value);
      }
    }, notation);
  }

  const page = await context.newPage();
  await page.goto(NOTES_URL + query);

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    // The page's own button, not the emulator's: "Continue with Google" here,
    // "Sign in with Google" in the popup that opens.
    page.getByRole('button', { name: /continue with google/i }).click(),
  ]);

  // The Auth emulator serves its own chooser: add an account, let it invent
  // the details, then sign in.
  //
  // Each step is waited for rather than sampled. `isVisible()` asked the
  // instant the document loads answers about a page the emulator has not
  // rendered yet, which skipped "add new account" and left the popup on a
  // screen with no sign-in button to click — a hang, not a failure.
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

  return { context, page };
}

/**
 * Change the notation the app is set to, and come back to the piece.
 *
 * The switch is on the tuner now — one setting for the whole app — so a test
 * that wants the other naming sets the preference and reloads rather than
 * reaching for a control this page no longer has.
 */
async function renameNotes(page: Page, notation: 'western' | 'sargam', piece: string) {
  await page.evaluate(
    (value) => window.localStorage.setItem('pitch.notation', value),
    notation,
  );
  await page.reload();
  await expect(page.locator('[data-account]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: piece }).click();
}

test('writes a phrase, saves it, and still has it after a reload', async () => {
  // Pin the naming, rather than depending on a remembered preference.
  const { context, page } = await openSignedIn('notes', undefined, undefined, 'sargam');

  await page.getByRole('button', { name: 'new', exact: true }).click();
  await expect(page.getByRole('group', { name: 'written notation' })).toBeVisible();

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
  await expect(page.locator('[data-account]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Untitled' }).click();

  // Four swaras and a hold survived the round trip through Firestore.
  await expect(page.getByText('Sa', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pa', { exact: true }).first()).toBeVisible();

  await context.close();
});

test('renames a piece and lists it under the new title', async () => {
  const { context, page } = await openSignedIn('notes-rename');

  await page.getByRole('button', { name: 'new', exact: true }).click();

  const title = page.getByLabel('title');
  await title.fill('Bhairav alap');

  await expect(page.getByRole('button', { name: 'Bhairav alap' })).toBeVisible({
    timeout: 15_000,
  });

  await context.close();
});

test('deletes a piece', async () => {
  const { context, page } = await openSignedIn('notes-delete');

  await page.getByRole('button', { name: 'new', exact: true }).click();
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
  await first.page.getByRole('button', { name: 'new', exact: true }).click();
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
  const { context, page } = await openSignedIn(
    'notes-caret',
    undefined,
    undefined,
    'sargam',
  );

  await page.getByRole('button', { name: 'new', exact: true }).click();
  const written = page.getByRole('group', { name: 'written notation' });
  await expect(written).toBeVisible();

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

  await page.getByRole('button', { name: 'new', exact: true }).click();
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
  await expect(page.locator('[data-account]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Untitled' }).click();

  const reloaded = page.getByRole('group', { name: 'written notation' });
  await expect(reloaded.locator('[data-bar]')).toHaveCount(1);
  await expect(reloaded.locator('[data-tie]')).toHaveCount(1);

  await context.close();
});

test('names the written notes in Western or sargam, on demand', async () => {
  const { context, page } = await openSignedIn(
    'notes-notation',
    undefined,
    undefined,
    'sargam',
  );

  await page.getByRole('button', { name: 'new', exact: true }).click();
  let written = page.getByRole('group', { name: 'written notation' });
  await expect(written).toBeVisible();

  // A new piece has Sa on C, so the tonic itself is C4.
  await page.keyboard.press('S');
  await page.keyboard.press('P');
  await expect(written.getByText('Sa', { exact: true })).toBeVisible();
  await expect(written.getByText('Pa', { exact: true })).toBeVisible();

  // Wait for the write, so reloading does not lose the phrase.
  await expect(page.getByText('saved', { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // The same two notes, named the Western way.
  await renameNotes(page, 'western', 'Untitled');
  written = page.getByRole('group', { name: 'written notation' });
  await expect(written.getByText('C4', { exact: true })).toBeVisible();
  await expect(written.getByText('G4', { exact: true })).toBeVisible();
  await expect(written.getByText('Sa', { exact: true })).toHaveCount(0);

  await context.close();
});

test('changing a piece tonic transposes it rather than rewriting it', async () => {
  const { context, page } = await openSignedIn(
    'notes-tonic',
    undefined,
    undefined,
    'western',
  );

  await page.getByRole('button', { name: 'new', exact: true }).click();
  const written = page.getByRole('group', { name: 'written notation' });
  await expect(written).toBeVisible();
  // Sa and Pa with Sa on C: C4 and G4.
  await page.keyboard.press('S');
  await page.keyboard.press('P');
  await expect(written.getByText('C4', { exact: true })).toBeVisible();
  await expect(written.getByText('G4', { exact: true })).toBeVisible();

  // Move Sa to D. The stored notation is degrees, so the piece transposes.
  await page.getByLabel('tonic of this piece').selectOption('2');

  await expect(written.getByText('D4', { exact: true })).toBeVisible();
  await expect(written.getByText('A4', { exact: true })).toBeVisible();
  await expect(written.getByText('C4', { exact: true })).toHaveCount(0);

  // In sargam it is still Sa and Pa, because the degrees never moved.
  await expect(page.getByText('saved', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await renameNotes(page, 'sargam', 'Untitled');

  const sargam = page.getByRole('group', { name: 'written notation' });
  await expect(sargam.getByText('Sa', { exact: true })).toBeVisible();
  await expect(sargam.getByText('Pa', { exact: true })).toBeVisible();

  await context.close();
});

test('undo steps back, and survives a reload', async () => {
  const { context, page } = await openSignedIn(
    'notes-undo',
    undefined,
    undefined,
    'sargam',
  );

  await page.getByRole('button', { name: 'new', exact: true }).click();
  const written = page.getByRole('group', { name: 'written notation' });
  await expect(written).toBeVisible();

  for (const key of ['S', 'R', 'G']) await page.keyboard.press(key);
  await expect(written.getByText('Ga', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'undo' }).click();
  await expect(written.getByText('Ga', { exact: true })).toHaveCount(0);
  await expect(written.getByText('Re', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'redo' }).click();
  await expect(written.getByText('Ga', { exact: true })).toBeVisible();

  // Let the write land, then come back to the piece.
  await expect(page.getByText('saved', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.reload();
  await expect(page.locator('[data-account]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Untitled' }).click();

  // The trail came back with the piece rather than starting empty.
  const reloaded = page.getByRole('group', { name: 'written notation' });
  await page.getByRole('button', { name: 'undo' }).click();
  await expect(reloaded.getByText('Ga', { exact: true })).toHaveCount(0);

  await context.close();
});

test('drags across the page to select, then replaces the selection', async () => {
  const { context, page } = await openSignedIn(
    'notes-drag',
    undefined,
    undefined,
    'sargam',
  );

  await page.getByRole('button', { name: 'new', exact: true }).click();
  const written = page.getByRole('group', { name: 'written notation' });
  await expect(written).toBeVisible();

  for (const key of ['S', 'R', 'G', 'm']) await page.keyboard.press(key);

  // Drag from the first cell across to the third.
  const first = written.getByText('Sa', { exact: true });
  const third = written.getByText('Ga', { exact: true });
  await first.hover();
  await page.mouse.down();
  await third.hover();
  await page.mouse.up();

  await expect(written.locator('[data-selected="true"]')).not.toHaveCount(0);

  // Typing replaces what was dragged over.
  await page.keyboard.press('P');
  await expect(written.getByText('Pa', { exact: true })).toBeVisible();
  await expect(written.getByText('Sa', { exact: true })).toHaveCount(0);
  // The note past the selection is untouched.
  await expect(written.getByText('Ma', { exact: true })).toBeVisible();

  await context.close();
});

/**
 * The editor on a phone.
 *
 * This is the densest screen in the app — a list of pieces, a title row, the
 * written page, a toolbar and a twelve-key keyboard — so it is the one most
 * likely to push something off the edge. Signed in against the emulator,
 * because the editor only exists for a real piece.
 */
for (const screen of [
  { name: 'small android', width: 640, height: 360 },
  { name: 'iphone 14', width: 844, height: 390 },
]) {
  test(`writes on a ${screen.name} without anything falling off the screen`, async () => {
    // Swara marks and Western names set differently, and either could be the
    // one that overflows, so the two sizes cover one naming each.
    const { context, page } = await openSignedIn(
      `notes-mobile-${screen.width}`,
      screen,
      undefined,
      screen.width < 800 ? 'sargam' : 'western',
    );

    await page.getByRole('button', { name: 'new', exact: true }).click();
    const written = page.getByRole('group', { name: 'written notation' });
    await expect(written).toBeVisible();

    // A full bar and a bit, so the page has real content on it.
    for (const key of ['S', 'R', 'G', 'm', '|', 'P', 'D', 'N', 'S']) {
      await page.keyboard.press(key);
    }
    await expect(written.locator('[data-bar]')).toHaveCount(1);

    expectNothingCutOff(await audit(page));

    await context.close();
  });
}

/**
 * The caps on this page that can be on: the piece you have open, the tie, and
 * play while it is playing. Each one had the plain hover riding along with it,
 * which repainted it white under the pointer and hid its near-white label.
 */
test('the caps that are on stay dark under the pointer', async () => {
  const { context, page } = await openSignedIn('notes-hover');

  await page.getByRole('button', { name: 'new', exact: true }).click();
  await expect(page.getByRole('group', { name: 'written notation' })).toBeVisible();

  await expectStaysDark(page.getByRole('button', { name: 'Untitled' }), 'the open piece');

  const tie = page.getByRole('button', { name: /^tie/ });
  await tie.click();
  await expectStaysDark(tie, 'the armed tie');

  await context.close();
});

/**
 * Stop has to reach the audio, not just the button.
 *
 * The phrase is scheduled onto the audio clock in one go, so a stop that only
 * touches React state leaves the piece playing to the end while the button
 * cheerfully says "play" again. This watches the real audio graph: pressing
 * stop must issue fresh stop calls to the oscillators already in flight.
 */
test('stopping playback silences what is already scheduled', async () => {
  const { context, page } = await openSignedIn('notes-stop');

  await page.getByRole('button', { name: 'new', exact: true }).click();
  await expect(page.getByRole('group', { name: 'written notation' })).toBeVisible();
  for (const key of ['S', 'R', 'G', 'm']) await page.keyboard.press(key);

  // Patched after load but before anything sounds: notes are only built when
  // play is pressed.
  await page.evaluate(() => {
    const spy = window as unknown as { __stops: number };
    spy.__stops = 0;
    const real = OscillatorNode.prototype.stop;
    OscillatorNode.prototype.stop = function (when?: number) {
      spy.__stops += 1;
      return real.call(this, when);
    };
  });

  await page.getByRole('button', { name: 'play', exact: true }).click();

  const stop = page.getByRole('button', { name: 'stop', exact: true });
  await expect(stop).toBeVisible();

  const scheduled = await page.evaluate(
    () => (window as unknown as { __stops: number }).__stops,
  );
  expect(scheduled, 'the phrase was scheduled').toBeGreaterThan(0);

  await stop.click();

  // Every source in flight is told to stop again, at the moment of the press
  // rather than at the end of its own note.
  const afterStop = await page.evaluate(
    () => (window as unknown as { __stops: number }).__stops,
  );
  expect(afterStop, 'stop reached the audio graph').toBeGreaterThan(scheduled);

  await expect(page.getByRole('button', { name: 'play', exact: true })).toBeVisible();

  await context.close();
});

/**
 * Practising a written piece.
 *
 * The microphone plays middle C throughout, so the first note of the piece is
 * the one being played and the rest are not — which is exactly what a
 * self-paced stage should show: one note got, and then a wait.
 */
test('practising a piece follows it note by note', async () => {
  const { context, page } = await openSignedIn('notes-practice', undefined, 261.63);

  await page.getByRole('button', { name: 'new', exact: true }).click();
  const written = page.getByRole('group', { name: 'written notation' });
  await expect(written).toBeVisible();

  for (const key of ['S', 'R', 'G']) await page.keyboard.press(key);

  // Practice first, microphone second. The injected tone sounds from the
  // moment the page loads, so opening the microphone before asserting the
  // starting state would race it — the first note can be got before the
  // assertion runs.
  await page.getByRole('button', { name: 'practice', exact: true }).click();

  // Caret slots carry data-line too, so the note cells are the ones that are
  // not slots. Without this, .first() is the caret before the first note.
  const cells = written.locator('button[data-line]:not([aria-label="place caret"])');

  // Before anything is heard, the first note is the one being waited for.
  await expect(cells.nth(0)).toHaveAttribute('data-target', 'true');

  await page.getByRole('button', { name: 'listen', exact: true }).click();

  // Middle C is that note, so it is got and the target moves to the second.
  await expect(cells.nth(0)).toHaveAttribute('data-verdict', 'hit', { timeout: 15_000 });
  await expect(cells.nth(1)).toHaveAttribute('data-target', 'true');

  // The bed alongside remembers the same note.
  await expect(page.getByRole('button', { name: /^Play C4/ })).toHaveAttribute(
    'data-mark',
    'in-tune',
  );

  // The piece waits: the second note is never played, so it is never got.
  await expect(cells.nth(1)).not.toHaveAttribute('data-verdict', 'hit');

  await context.close();
});

test('the swara keyboard gives way to the bed while practising', async () => {
  const { context, page } = await openSignedIn('notes-practice-bed');

  await page.getByRole('button', { name: 'new', exact: true }).click();
  await expect(page.getByRole('group', { name: 'written notation' })).toBeVisible();

  await expect(page.getByRole('group', { name: 'saptak' })).toBeVisible();

  await page.getByRole('button', { name: 'practice', exact: true }).click();

  await expect(page.getByRole('group', { name: 'saptak' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Play / }).first()).toBeVisible();

  await context.close();
});

/**
 * The timed run.
 *
 * The microphone plays middle C throughout, so of a three-note piece exactly
 * one note is the note being played and the other two are not. A run that
 * scored everything, or nothing, would pass a weaker assertion than this one.
 */
test('a timed run counts in and then scores the piece', async () => {
  const { context, page } = await openSignedIn('notes-run', undefined, 261.63);

  await page.getByRole('button', { name: 'new', exact: true }).click();
  const written = page.getByRole('group', { name: 'written notation' });
  await expect(written).toBeVisible();

  // Sa Re Ga on a piece whose Sa is C: C4, D4, E4.
  for (const key of ['S', 'R', 'G']) await page.keyboard.press(key);

  await page.getByRole('button', { name: 'listen', exact: true }).click();
  await page.getByRole('button', { name: 'practice', exact: true }).click();
  await page.getByRole('button', { name: 'practice settings' }).click();

  const panel = page.getByRole('dialog', { name: 'practice settings' });
  await panel.getByRole('button', { name: 'run', exact: true }).click();
  await panel.getByRole('button', { name: 'start the run' }).click();

  // The run says where it is above the bed, not in the panel — and the
  // count-in is a three second window, so this accepts either side of it
  // rather than trying to catch one frame of it.
  await expect(page.getByText(/counting in|playing/i)).toBeVisible({ timeout: 5_000 });

  // A bar of count-in, then the piece: at 80bpm that is 3s plus 2.25s.
  await expect(panel.getByText(/in tune, in time/)).toBeVisible({ timeout: 20_000 });

  // Only the first note is the one being played, so only it can be a hit.
  await expect(panel.getByText('1 of 3 in tune, in time.')).toBeVisible();

  await context.close();
});

/*
 * Sheet music, behind its flag.
 *
 * The flag is build-time, so the tests reach it through the development-only
 * query seam — the same arrangement as ?emulator=1 — and point recognition at
 * a route this file answers itself. Audiveris is not under test here; the
 * promise that is, is that a scan becomes notes and nothing of the scan is
 * kept.
 */

const OMR_STUB = 'http://127.0.0.1:5174/omr-stub';
const SHEET_ON = `&sheet=1&omr=${OMR_STUB}`;

/** What the stub recogniser answers with: two bars in G, at 96. */
const RECOGNISED = scoreFromLines(
  parseNotation('S R G m | P - - -'),
  7,
  'Etude',
  96,
).musicXml;

/** A one-pixel PNG, so the picker has a real image to preview. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const FIRESTORE =
  'http://127.0.0.1:8080/v1/projects/pitchperfect-e6070/databases/(default)';

/** Every composition in the emulator, read past the rules as the owner. */
async function allCompositions(): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${FIRESTORE}/documents:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({
      structuredQuery: { from: [{ collectionId: 'compositions', allDescendants: true }] },
    }),
  });
  const rows = (await response.json()) as { document?: Record<string, unknown> }[];
  return rows.flatMap((row) => (row.document ? [row.document] : []));
}

test('sheet controls stay hidden while the feature is off', async () => {
  const { context, page } = await openSignedIn('notes-sheet-off');

  await expect(page.getByRole('button', { name: /import sheet/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'new', exact: true }).click();
  await expect(page.getByRole('group', { name: 'written notation' })).toBeVisible();
  await expect(page.getByRole('button', { name: /view sheet/i })).toHaveCount(0);

  await context.close();
});

test('imports a scanned sheet as notes, and keeps nothing of the scan', async () => {
  const { context, page } = await openSignedIn(
    'notes-sheet-import',
    undefined,
    undefined,
    undefined,
    SHEET_ON,
  );

  let received: { field: string; bytes: number } | null = null;
  await page.route(`${OMR_STUB}/recognize`, async (route) => {
    const body = route.request().postDataBuffer() ?? Buffer.alloc(0);
    // One multipart field named sheet, carrying the file.
    received = {
      field: /name="([^"]+)"/.exec(body.toString('latin1'))?.[1] ?? '',
      bytes: body.length,
    };
    await route.fulfill({
      json: { musicXml: RECOGNISED, warnings: ['The stub says check bar two.'] },
    });
  });

  await page.getByRole('button', { name: 'import sheet' }).click();
  await page
    .getByLabel('sheet file')
    .setInputFiles({ name: 'scan.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('img', { name: /scan\.png/ })).toBeVisible();

  await page.getByRole('button', { name: 'scan sheet' }).click();

  // Review: what was read, against the Sa the key signature suggested.
  await expect(page.getByLabel('title')).toHaveValue('Etude');
  await expect(page.getByLabel('tonic')).toHaveValue('7');
  await expect(page.getByLabel('notation')).toHaveValue('S R G m | P - - -');
  await expect(page.getByRole('list', { name: 'check these' })).toContainText(
    'check bar two',
  );
  expect(received).toEqual({ field: 'sheet', bytes: expect.any(Number) });
  expect(received!.bytes).toBeGreaterThan(PNG.length);

  // A correction, then the piece.
  await page.getByLabel('notation').fill('S R G m | P - - - | S');
  await page.getByRole('button', { name: 'create piece' }).click();

  const written = page.getByRole('group', { name: 'written notation' });
  await expect(written).toBeVisible();
  await expect(page.getByRole('button', { name: 'Etude' })).toHaveAttribute(
    'aria-current',
    'true',
  );

  // The piece has a sheet, and it opens and draws.
  await page.getByRole('button', { name: 'view sheet' }).click();
  const preview = page.getByRole('dialog', { name: 'sheet preview' });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('button', { name: 'download musicxml' })).toBeVisible();
  await expect(preview.getByRole('button', { name: 'print' })).toBeEnabled({
    timeout: 20_000,
  });
  await preview.getByRole('button', { name: 'close' }).click();

  // What Firestore actually holds: the notes and the symbolic score, and no
  // trace of the file — not its bytes, not a data URL, not the preview URL.
  const stored = (await allCompositions()).find((doc) =>
    JSON.stringify(doc).includes('"Etude"'),
  );
  expect(stored).toBeDefined();
  const fields = (stored as { fields: Record<string, unknown> }).fields;
  expect(Object.keys(fields).sort()).toEqual(
    ['createdAt', 'notation', 'score', 'title', 'tonic', 'updatedAt'].sort(),
  );
  expect(fields.notation).toEqual({ stringValue: 'S R G m | P - - - | S' });
  expect(fields.tonic).toEqual({ integerValue: '7' });
  const score = (fields.score as { mapValue: { fields: Record<string, unknown> } })
    .mapValue.fields;
  expect(score.source).toEqual({ stringValue: 'imported' });
  expect(score.tempo).toEqual({ integerValue: '96' });
  expect((score.musicXml as { stringValue: string }).stringValue).toContain(
    '<score-partwise',
  );

  const everything = JSON.stringify(stored);
  expect(everything).not.toContain('blob:');
  expect(everything).not.toContain('data:image');
  expect(everything).not.toContain(PNG.toString('base64').slice(0, 20));
  expect(everything).not.toContain('scan.png');

  // And it is really saved: a reload finds it, notes and sheet alike.
  await page.reload();
  await page.getByRole('button', { name: 'Etude' }).click();
  await expect(page.getByRole('group', { name: 'written notation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'view sheet' })).toBeVisible();

  await context.close();
});

test('a sheet that will not scan keeps the file on screen and says why', async () => {
  const { context, page } = await openSignedIn(
    'notes-sheet-fails',
    undefined,
    undefined,
    undefined,
    SHEET_ON,
  );

  await page.route(`${OMR_STUB}/recognize`, (route) =>
    route.fulfill({ status: 422, json: { error: 'no staff found' } }),
  );

  await page.getByRole('button', { name: 'import sheet' }).click();
  await page
    .getByLabel('sheet file')
    .setInputFiles({ name: 'scan.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'scan sheet' }).click();

  await expect(page.getByRole('alert')).toContainText(/could not read music/i);
  await expect(page.getByRole('img', { name: /scan\.png/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'scan sheet' })).toBeEnabled();

  // Nothing was created.
  await page.getByRole('button', { name: 'cancel' }).click();
  await expect(page.getByText('nothing yet')).toBeVisible();

  await context.close();
});
