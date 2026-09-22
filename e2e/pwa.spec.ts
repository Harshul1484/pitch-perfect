import { chromium, expect, test, type Page } from '@playwright/test';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The installed app: a manifest the browser accepts, a worker that keeps the
 * build, and a page that opens with the network gone.
 *
 * This runs against a production build served by `vite preview`, not the dev
 * server the other specs use: the worker is only emitted and only registered
 * in a production build, since a worker serving a cached shell over a live
 * dev server is a debugging session nobody wants.
 */

const PORT = 4174;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const VITE = 'node_modules/vite/bin/vite.js';

let preview: ChildProcess;

test.beforeAll(async () => {
  test.setTimeout(180_000);

  const build = spawnSync(process.execPath, [VITE, 'build'], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (build.status !== 0) throw new Error(`vite build failed:\n${build.stderr}`);

  preview = spawn(
    process.execPath,
    [VITE, 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { stdio: 'pipe' },
  );

  const started = Date.now();
  for (;;) {
    try {
      const response = await fetch(ORIGIN);
      if (response.ok) break;
    } catch {
      // Not up yet.
    }
    if (Date.now() - started > 30_000) throw new Error('vite preview did not start');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
});

test.afterAll(() => {
  preview?.kill();
});

/** Wait until a worker is controlling the page, which means install finished. */
async function controlled(page: Page) {
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    {
      timeout: 20_000,
    },
  );
}

test('serves a manifest the browser can install from', async () => {
  const manifest = await fetch(`${ORIGIN}/manifest.webmanifest`).then((r) => r.json());

  expect(manifest.name).toBe('Perfect Pitch');
  expect(manifest.display).toBe('standalone');
  expect(manifest.orientation).toBe('landscape');
  expect(manifest.start_url).toBe('/');

  // Every icon it names is really there, and a maskable one is among them.
  for (const icon of manifest.icons) {
    const response = await fetch(`${ORIGIN}${icon.src}`);
    expect(response.status, icon.src).toBe(200);
    expect(response.headers.get('content-type'), icon.src).toContain(
      icon.type.split('/')[1],
    );
  }
  expect(
    manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable'),
  ).toBe(true);

  const html = await fetch(ORIGIN).then((r) => r.text());
  expect(html).toContain('rel="manifest"');
  expect(html).toContain('name="theme-color"');
});

test('ships a worker stamped with this build', async () => {
  const worker = await fetch(`${ORIGIN}/sw.js`).then((r) => r.text());

  expect(worker).toMatch(/const VERSION = "[a-f0-9]{12}"/);
  expect(worker).not.toContain('__VERSION__');
  expect(worker).not.toContain('@__PRECACHE__');
  expect(worker).toContain('"/index.html"');
  expect(worker).toContain('"/manifest.webmanifest"');
  expect(worker).toMatch(/"\/assets\/index-[^"]+\.js"/);
});

test('once installed, opens without a network', async () => {
  const context = await chromium.launchPersistentContext('', { channel: 'chrome' });
  const page = await context.newPage();

  await page.goto(ORIGIN);
  await expect(page.getByRole('button', { name: 'listen' })).toBeVisible();
  await controlled(page);

  await context.setOffline(true);

  // The tuner, from the cache.
  await page.reload();
  await expect(page.getByRole('button', { name: 'listen' })).toBeVisible();
  await expect(page.getByText('Perfect Pitch')).toBeVisible();

  // A route that was never visited in this session, from the same shell.
  await page.goto(`${ORIGIN}/notes`);
  await expect(page.getByRole('link', { name: 'tuner' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'notes' })).toBeVisible();

  await context.setOffline(false);
  await context.close();
});

test('offers to install when the browser does, and opens its dialog', async () => {
  const context = await chromium.launchPersistentContext('', { channel: 'chrome' });

  // Chrome fires the real beforeinstallprompt against this build — it meets
  // the criteria — and its real dialog cannot be driven from a test. So the
  // event is caught first, in the capture phase, and its dialog swapped for
  // a flag; the page's own listener then runs against that.
  await context.addInitScript(() => {
    window.addEventListener(
      'beforeinstallprompt',
      (event) => {
        Object.defineProperty(event, 'prompt', {
          value: async () => {
            (window as unknown as { __prompted: boolean }).__prompted = true;
          },
        });
        Object.defineProperty(event, 'userChoice', {
          value: Promise.resolve({ outcome: 'accepted' }),
        });
      },
      true,
    );
  });

  const page = await context.newPage();
  await page.goto(ORIGIN);

  // Chrome's offer arrives on its own schedule; if it has not by now, stand
  // in for it, so the rest of the flow is exercised either way.
  const cap = page.getByRole('button', { name: 'install' });
  if (!(await cap.isVisible().catch(() => false))) {
    await page.waitForTimeout(1500);
  }
  if (!(await cap.isVisible().catch(() => false))) {
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
    });
  }

  await expect(cap).toBeVisible();
  await cap.click();

  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted),
    )
    .toBe(true);
  // The offer is good for one dialog, so the cap goes once it has been used.
  await expect(page.getByRole('button', { name: 'install' })).toHaveCount(0);

  await context.close();
});

/**
 * A deploy landing under a session that is still open.
 *
 * Rather than build twice, the served worker is rewritten with a different
 * version — which is exactly what a new build looks like to the browser: the
 * bytes at /sw.js differ, so it installs a second worker, which then waits.
 */
const SW = 'dist/sw.js';

test('a deploy that lands mid-session offers itself rather than taking over', async () => {
  test.setTimeout(150_000);

  // Its own profile, wiped first. This test installs a second worker, and a
  // profile carried over from a previous run starts with one already in the
  // waiting slot — which is the very thing the first assertion denies.
  const profile = resolve('.e2e-profile', 'pwa-update');
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome' });
  const page = await context.newPage();

  await page.goto(ORIGIN);
  await expect(page.getByRole('button', { name: 'listen' })).toBeVisible();
  await controlled(page);

  // Nothing to announce while this is the newest build.
  await expect(page.getByRole('button', { name: /^updat/ })).toHaveCount(0);

  const original = readFileSync(SW, 'utf8');
  try {
    writeFileSync(
      SW,
      original.replace(/const VERSION = "[a-f0-9]+"/, 'const VERSION = "0000deadbeef"'),
    );

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration!.update();
    });

    // The cap appears, and the page is still being served by the old build.
    // Installing a build takes as long as it takes, and this suite runs a
    // browser per test before it gets here.
    const cap = page.getByRole('button', { name: 'update' });
    await expect(cap).toBeVisible({ timeout: 60_000 });

    // Installed, but still waiting: the old worker is the one in charge.
    // The new cache exists — install fills it — so what proves it has not
    // taken over is that the previous build's cache is still there and a
    // worker is sitting in the waiting slot.
    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return {
        waiting: registration?.waiting !== null,
        caches: (await caches.keys()).length,
      };
    });
    expect(state.waiting, 'a newer worker should be waiting').toBe(true);
    expect(state.caches, 'both builds cached while the old one is in charge').toBe(2);

    // Taking it hands over and reloads.
    await cap.click();
    await page.waitForLoadState('load');
    await expect(page.getByRole('button', { name: 'listen' })).toBeVisible({
      timeout: 20_000,
    });

    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const keys = await caches.keys();
            return keys.some((key) => key.includes('0000deadbeef'));
          }),
        { timeout: 20_000, message: 'the new build should be the one in charge now' },
      )
      .toBe(true);

    // And the old build's cache is gone, which is why it had to wait.
    await expect
      .poll(() => page.evaluate(async () => (await caches.keys()).length), {
        timeout: 20_000,
        message: 'the previous build cache should be swept up on activation',
      })
      .toBe(1);

    await expect(page.getByRole('button', { name: /^updat/ })).toHaveCount(0);
  } finally {
    writeFileSync(SW, original);
    await context.close();
  }
});
