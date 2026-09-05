import { expect, test } from '@playwright/test';
import { openWithTone } from './fake-microphone';

/**
 * Practice mode on the tuner.
 *
 * The point of the feature is what the bed shows *after* a note has stopped
 * sounding, so every test here plays a note, silences the microphone, and then
 * asks what is still on the screen. Testing it while the note is still playing
 * would only re-test the live tint, which has always worked.
 */

/** Stop the injected microphone, so only memory is left on the bed. */
async function stopPlaying(page: import('@playwright/test').Page) {
  await page.evaluate(() => (window as unknown as { silence?: () => void }).silence?.());
}

test('the bed remembers a note after you have stopped playing it', async () => {
  const { context, page } = await openWithTone(440, 'practice');

  await page.getByRole('button', { name: 'listen' }).click();
  await page.getByRole('button', { name: 'practice', exact: true }).click();

  const a4 = page.getByRole('button', { name: /^Play A4/ });
  await expect(a4).toHaveAttribute('data-state', 'in-tune', { timeout: 15_000 });

  await stopPlaying(page);

  // The live tint goes; the mark stays.
  await expect(a4).toHaveAttribute('data-state', 'idle', { timeout: 15_000 });
  await expect(a4).toHaveAttribute('data-mark', 'in-tune');

  await context.close();
});

test('a note played out of tune is remembered as out', async () => {
  // 466Hz is A♯4 (466.16) played about -1 cent, and A4 played 100 sharp — the
  // detector calls it A♯4, so to be out of tune we need a pitch between notes.
  const { context, page } = await openWithTone(452, 'practice-out');

  await page.getByRole('button', { name: 'listen' }).click();
  await page.getByRole('button', { name: 'practice', exact: true }).click();

  const a4 = page.getByRole('button', { name: /^Play A4/ });
  await expect(a4).toHaveAttribute('data-mark', 'out', { timeout: 15_000 });

  await context.close();
});

test('nothing is remembered until practice is switched on', async () => {
  const { context, page } = await openWithTone(440, 'practice-off');

  await page.getByRole('button', { name: 'listen' }).click();

  const a4 = page.getByRole('button', { name: /^Play A4/ });
  await expect(a4).toHaveAttribute('data-state', 'in-tune', { timeout: 15_000 });

  await stopPlaying(page);
  await expect(a4).toHaveAttribute('data-state', 'idle', { timeout: 15_000 });

  expect(await a4.getAttribute('data-mark')).toBeNull();

  await context.close();
});

test('reset clears what the bed remembered', async () => {
  const { context, page } = await openWithTone(440, 'practice-reset');

  await page.getByRole('button', { name: 'listen' }).click();
  await page.getByRole('button', { name: 'practice', exact: true }).click();

  const a4 = page.getByRole('button', { name: /^Play A4/ });
  await expect(a4).toHaveAttribute('data-mark', 'in-tune', { timeout: 15_000 });

  await stopPlaying(page);
  await page.getByRole('button', { name: 'practice settings' }).click();
  await page.getByRole('button', { name: 'reset' }).click();

  await expect(a4).not.toHaveAttribute('data-mark', 'in-tune');

  await context.close();
});

test('the chosen hold fades a mark away on its own', async () => {
  const { context, page } = await openWithTone(440, 'practice-fade');

  await page.getByRole('button', { name: 'listen' }).click();
  await page.getByRole('button', { name: 'practice', exact: true }).click();

  // The shortest hold, so the test does not have to wait half a minute.
  await page.getByRole('button', { name: 'practice settings' }).click();
  await page.getByRole('group', { name: 'colour hold' }).getByRole('button', { name: '5s', exact: true }).click();
  await page.keyboard.press('Escape');

  const a4 = page.getByRole('button', { name: /^Play A4/ });
  await expect(a4).toHaveAttribute('data-mark', 'in-tune', { timeout: 15_000 });

  await stopPlaying(page);

  // Five seconds after the note ends, the colour goes by itself.
  await expect(a4).not.toHaveAttribute('data-mark', 'in-tune', { timeout: 15_000 });

  await context.close();
});

test('the hold is remembered between visits', async () => {
  const { context, page } = await openWithTone(440, 'practice-hold-kept');

  await page.getByRole('button', { name: 'practice settings' }).click();
  await page.getByRole('group', { name: 'colour hold' }).getByRole('button', { name: '2m', exact: true }).click();

  await page.reload();
  await page.getByRole('button', { name: 'practice settings' }).click();

  await expect(
    page.getByRole('group', { name: 'colour hold' }).getByRole('button', { name: '2m', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  await context.close();
});
