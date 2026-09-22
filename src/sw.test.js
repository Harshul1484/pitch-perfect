import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The worker is three rules; each is checked against a stand-in for the
 * worker's world — one object with the caches, the network, and the clients
 * on it — so that what it does is what is asserted, not what it says.
 */

/** A Cache that remembers what was put in it and can be asked for it back. */
function fakeCache() {
  const store = new Map();
  const key = (request) => (typeof request === 'string' ? request : request.url);
  return {
    store,
    addAll: vi.fn(async (urls) => {
      for (const url of urls) store.set(url, new Response(`precached ${url}`));
    }),
    match: vi.fn(async (request) => store.get(key(request)) ?? undefined),
    put: vi.fn(async (request, response) => {
      store.set(key(request), response);
    }),
  };
}

function fakeWorld() {
  const caches = new Map();
  const handlers = {};
  const world = {
    location: { origin: 'https://pitch.example' },
    addEventListener: (type, handler) => {
      handlers[type] = handler;
    },
    caches: {
      open: vi.fn(async (name) => {
        if (!caches.has(name)) caches.set(name, fakeCache());
        return caches.get(name);
      }),
      keys: vi.fn(async () => Array.from(caches.keys())),
      delete: vi.fn(async (name) => caches.delete(name)),
    },
    fetch: vi.fn(),
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  };
  return { world, handlers, caches };
}

/**
 * A request as the worker sees one. A plain object rather than a Request:
 * the worker reads three fields and hands the rest to the caches and the
 * network, which are stand-ins here — and a real Request cannot be given
 * the navigate mode from script anyway.
 */
const request = (url, init = {}) => ({
  url,
  method: init.method ?? 'GET',
  mode: init.mode ?? 'cors',
});

/** Run a listener the way the browser would, and collect what it responded with. */
async function dispatch(handler, request) {
  let responded = null;
  let waited = null;
  await handler({
    request,
    respondWith: (promise) => {
      responded = promise;
    },
    waitUntil: (promise) => {
      waited = promise;
    },
  });
  return {
    response: responded ? await responded : null,
    waited: waited ? await waited : null,
  };
}

describe('the service worker', () => {
  let world;
  let handlers;
  let caches;

  beforeEach(async () => {
    vi.resetModules();
    ({ world, handlers, caches } = fakeWorld());
    vi.stubGlobal('self', world);
    await import('./sw.js');
  });

  it('precaches the build at install', async () => {
    await dispatch(handlers.install, null);

    const [name, cache] = Array.from(caches.entries())[0];
    expect(name).toMatch(/^perfect-pitch-/);
    expect(cache.addAll).toHaveBeenCalledTimes(1);
  });

  it('waits rather than taking over a page still running the old build', async () => {
    // Taking over deletes the previous build's cache, and a page served by
    // that build still needs it for any route it has not opened yet.
    await dispatch(handlers.install, null);

    expect(world.skipWaiting).not.toHaveBeenCalled();
  });

  it('takes over when a page asks it to, and not for any other message', async () => {
    await dispatch(handlers.install, null);

    await handlers.message({ data: { type: 'something-else' } });
    expect(world.skipWaiting).not.toHaveBeenCalled();

    await handlers.message({ data: null });
    expect(world.skipWaiting).not.toHaveBeenCalled();

    await handlers.message({ data: { type: 'skip-waiting' } });
    expect(world.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('removes older caches of its own at activate, and no one else’s', async () => {
    await world.caches.open('perfect-pitch-old-build');
    await world.caches.open('someone-elses-cache');
    await dispatch(handlers.install, null);

    await dispatch(handlers.activate, null);

    const remaining = Array.from(caches.keys());
    expect(remaining).not.toContain('perfect-pitch-old-build');
    expect(remaining).toContain('someone-elses-cache');
    expect(remaining.some((k) => k.startsWith('perfect-pitch-'))).toBe(true);
    expect(world.clients.claim).toHaveBeenCalled();
  });

  it('leaves other origins and non-GET requests alone', async () => {
    const firebase = await dispatch(
      handlers.fetch,
      request('https://firestore.googleapis.com/v1/x'),
    );
    const post = await dispatch(
      handlers.fetch,
      request('https://pitch.example/assets/app.js', { method: 'POST' }),
    );

    expect(firebase.response).toBeNull();
    expect(post.response).toBeNull();
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it('serves a navigation from the network and keeps a copy as the shell', async () => {
    world.fetch.mockResolvedValue(new Response('<html>fresh</html>', { status: 200 }));

    const { response } = await dispatch(
      handlers.fetch,
      request('https://pitch.example/notes', { mode: 'navigate' }),
    );

    expect(await response.text()).toBe('<html>fresh</html>');
    const cache = Array.from(caches.values())[0];
    expect(cache.store.has('/index.html')).toBe(true);
  });

  it('serves the cached shell when a navigation cannot reach the network', async () => {
    world.fetch.mockResolvedValueOnce(
      new Response('<html>shell</html>', { status: 200 }),
    );
    await dispatch(
      handlers.fetch,
      request('https://pitch.example/', { mode: 'navigate' }),
    );

    world.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const { response } = await dispatch(
      handlers.fetch,
      request('https://pitch.example/notes', { mode: 'navigate' }),
    );

    expect(await response.text()).toBe('<html>shell</html>');
  });

  it('does not cache a failed navigation as the shell', async () => {
    world.fetch.mockResolvedValue(new Response('nope', { status: 500 }));

    await dispatch(
      handlers.fetch,
      request('https://pitch.example/', { mode: 'navigate' }),
    );

    const cache = Array.from(caches.values())[0];
    expect(cache.store.has('/index.html')).toBe(false);
  });

  it('serves a hashed asset from cache after the first fetch', async () => {
    world.fetch.mockResolvedValue(new Response('js', { status: 200 }));
    const asset = () => request('https://pitch.example/assets/app-abc123.js');

    const first = await dispatch(handlers.fetch, asset());
    const second = await dispatch(handlers.fetch, asset());

    expect(await first.response.text()).toBe('js');
    expect(await second.response.text()).toBe('js');
    expect(world.fetch).toHaveBeenCalledTimes(1);
  });

  it('passes an unknown same-origin path through untouched', async () => {
    const { response } = await dispatch(
      handlers.fetch,
      request('https://pitch.example/some/api'),
    );

    expect(response).toBeNull();
    expect(world.fetch).not.toHaveBeenCalled();
  });
});
