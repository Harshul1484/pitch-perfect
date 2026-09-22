/*
 * The service worker: what makes the installed app open without a network.
 *
 * Three rules, and nothing cleverer:
 *
 *   - At install, every file the build produced is fetched into a cache named
 *     after this build. That is the whole app — the tuner, the notes route,
 *     the fonts — so once installed it opens with the radio off.
 *   - Files under /assets/ carry a content hash in their name, so a cached one
 *     is never stale. They are served from cache first and fetched only once.
 *   - Navigations go to the network first, so a deploy is picked up the next
 *     time the app is opened online, and fall back to the cached shell when
 *     there is no network. Anything on another origin — Firebase, Google
 *     sign-in — is not touched.
 *
 * The version and the file list are stamped in by the build (see the plugin
 * in vite.config.ts). A new build is a new cache; the old one is removed when
 * the new worker takes over, which it does only when a page asks it to.
 *
 * Written against `self.` throughout, rather than the bare globals a worker
 * also has, so that a test can hand it one object and watch what it does.
 */

const VERSION = '__VERSION__';
const PRECACHE = /* @__PRECACHE__ */ [];

const PREFIX = 'perfect-pitch-';
const CACHE = PREFIX + VERSION;
/** Where the shell is kept, whichever path the navigation was to. */
const SHELL = '/index.html';

/*
 * Matched without regard to Vary. Servers put `Vary: Origin` on these files
 * for CORS bookkeeping, and a module script asks for one with an Origin
 * header the precache fetch did not send — so an honest match would miss a
 * file that is byte-for-byte the one wanted. Everything cached here is
 * same-origin and named by its content, so there is nothing for Vary to
 * distinguish.
 */
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(self.caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

/*
 * A new worker waits until it is asked to take over.
 *
 * It must not take over on its own. Activating deletes the previous build's
 * cache, and a page that is still open was served by that build: the moment
 * it lazily imports a route it has not opened yet, it asks for a file named
 * with the old build's hash — gone from the cache, and gone from the server
 * too. So the page is told an update is ready and decides when to take it,
 * which it does by reloading immediately afterwards.
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
            .map((key) => self.caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
    return;
  }

  if (url.pathname.startsWith('/assets/') || PRECACHE.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

/**
 * The network first, so a new deploy is seen; the cached shell when there is
 * none. Whatever path was navigated to, the server answers with the same
 * page, so the fresh copy is filed under the one shell key.
 */
async function navigation(request) {
  const cache = await self.caches.open(CACHE);
  try {
    const fresh = await self.fetch(request);
    if (fresh.ok) await cache.put(SHELL, fresh.clone());
    return fresh;
  } catch (cause) {
    const shell = await cache.match(SHELL, MATCH);
    if (shell) return shell;
    throw cause;
  }
}

/** Cached if it has been seen; fetched and kept if not. For files that never change. */
async function cacheFirst(request) {
  const cache = await self.caches.open(CACHE);
  const hit = await cache.match(request, MATCH);
  if (hit) return hit;

  const fresh = await self.fetch(request);
  if (fresh.ok) await cache.put(request, fresh.clone());
  return fresh;
}
