import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Files in public/ the worker should also keep. Not in the bundle, so listed by hand. */
const PUBLIC_FILES = [
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

/**
 * Emits the service worker with this build's file list and version stamped in.
 *
 * src/sw.js is written once and never edited per build; the two placeholders
 * in it are filled here from what Rollup actually produced, so the worker's
 * precache list can never drift from the files that exist. The version is a
 * hash of that list plus index.html, which changes whenever any hashed asset
 * does — a new build is a new cache, and the worker removes the old one.
 *
 * Build only: in development there is no worker, since a worker serving a
 * cached shell over a live dev server is a debugging session nobody wants.
 */
function serviceWorker(): Plugin {
  return {
    name: 'perfect-pitch:service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle)
        .filter((file) => !file.endsWith('.map'))
        // Only the fonts the interface actually asks for go in at install: the
        // Latin woff2 of each face. The other subsets and the legacy woff are
        // a megabyte the app never requests; if a browser ever does, they are
        // still served cache-first on the way through.
        .filter((file) => !/.woff2?$/.test(file) || /-latin-.*.woff2$/.test(file))
        .map((file) => '/' + file);
      const precache = Array.from(new Set([...built, ...PUBLIC_FILES])).sort();

      const index = bundle['index.html'];
      const shell = index && index.type === 'asset' ? String(index.source) : '';
      const version = createHash('sha1')
        .update(precache.join('\n'))
        .update(shell)
        .digest('hex')
        .slice(0, 12);

      const source = readFileSync(
        fileURLToPath(new URL('./src/sw.js', import.meta.url)),
        'utf8',
      )
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace('/* @__PRECACHE__ */ []', JSON.stringify(precache));

      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright owns e2e/; vitest would otherwise try to run those specs.
    // A git worktree under .worktrees/ is a whole second checkout with tests
    // of its own, run from there and never from here.
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/.worktrees/**'],
    css: true,
  },
});
