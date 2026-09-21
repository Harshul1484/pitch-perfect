/**
 * Ask the browser to run the service worker, in a production build only.
 *
 * Offline is a nicety and never a dependency: if registration fails — an
 * old browser, a private window that forbids it — the app runs exactly as
 * before, from the network. Nothing waits on this, which is why it goes
 * after the page has loaded rather than competing with it.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Deliberately silent: there is nothing the player can do about it and
      // nothing they have lost.
    });
  });
}
