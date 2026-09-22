/**
 * The service worker's side of the conversation with the page.
 *
 * Registration is a nicety and never a dependency: if it fails — an old
 * browser, a private window that forbids it — the app runs exactly as before,
 * from the network.
 *
 * The rest of this file exists because a new build must not take over a page
 * that is still running on the old one. Activating deletes the previous
 * build's cache, and a page served by that build will ask for its hashed
 * chunks the moment it opens a route it has not opened yet — by then gone from
 * the cache and from the server. So a new worker waits, the page is told, and
 * the player decides when to take it.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
/** The installed-but-waiting worker, once there is one. */
let waiting: ServiceWorker | null = null;
/** Whether a worker was already in charge when this page loaded. */
let hadController = false;
/** Whether this page asked for the handover, rather than another tab. */
let asked = false;
let reloading = false;

function announce(worker: ServiceWorker): void {
  waiting = worker;
  for (const listener of listeners) listener();
}

/** Whether a newer build is installed and waiting to be taken. */
export function isUpdateReady(): boolean {
  return waiting !== null;
}

/** Call back when one becomes ready. Returns the unsubscribe. */
export function onUpdateReady(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Take the waiting build.
 *
 * The worker takes over, which fires controllerchange, which reloads the page
 * so that everything it goes on to ask for comes from the new build.
 */
export function applyUpdate(): void {
  if (!waiting) return;
  asked = true;
  waiting.postMessage({ type: 'skip-waiting' });
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // Read before registering: on a first visit there is no controller, and the
  // worker claiming the page is not an update to reload for.
  hadController = navigator.serviceWorker.controller !== null;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // A first visit's worker claiming this page is not a handover and must
    // not reload it. A handover is either one this page asked for, or one
    // another tab asked for while this page already had a controller — and
    // in both cases the build underneath has changed.
    if (reloading || (!asked && !hadController)) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        /*
         * A worker in the waiting slot is the condition, and the only one.
         * It is there when a build has installed behind the one in charge.
         * Reading it is steadier than
         * inferring an update from the order install and claim happen in,
         * which under load do not always arrive when expected.
         */
        const check = () => {
          // Both halves matter. A worker sits in the waiting slot for a
          // moment on a first install too, before it activates — so what
          // makes it an update is that there is already an active worker for
          // it to be waiting behind.
          if (registration.waiting && registration.active) {
            announce(registration.waiting);
          }
        };

        // Already waiting when this page opened: the update arrived while
        // the app was closed, or in another tab.
        check();

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', check);
        });
      })
      .catch(() => {
        // Deliberately silent: there is nothing the player can do about it and
        // nothing they have lost.
      });
  });
}
