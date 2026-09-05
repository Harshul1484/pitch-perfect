import { expect, type Locator } from '@playwright/test';

/**
 * Reading the colour a cap actually ended up with.
 *
 * Shared because the same question is asked on both routes, and because a
 * cascade argument can only be settled by what the browser computed, never by
 * what the class list looks like.
 */

/** --color-graphite and --color-panel, as the browser reports them. */
export const GRAPHITE = 'rgb(43, 43, 43)';
export const PANEL = 'rgb(250, 250, 250)';

/** A cap crosses to its on state over 200ms; nothing is read mid-flight. */
const SETTLE_MS = 300;

export async function colours(control: Locator) {
  return control.evaluate((el) => {
    const style = getComputedStyle(el);
    return { background: style.backgroundColor, text: style.color };
  });
}

/** On, then on with the pointer over it — the label must stay readable. */
export async function expectStaysDark(control: Locator, what: string) {
  const dark = { background: GRAPHITE, text: PANEL };

  await expect
    .poll(() => colours(control), { message: `${what} before hover` })
    .toEqual(dark);

  await control.hover();
  // A wait, not a poll: a poll would pass on the first frame and miss a
  // repaint that only arrives once the hover transition has run.
  await control.page().waitForTimeout(SETTLE_MS);

  expect(await colours(control), `${what} while hovered`).toEqual(dark);
}
