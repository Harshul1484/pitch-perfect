import { useCallback, useEffect, useState } from 'react';

/**
 * The event Chromium fires when a page may be installed. Not in the DOM
 * typings, because only Chromium fires it.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * How this page could be installed, if at all.
 *
 *   prompt  the browser has offered, and install() will show its dialog
 *   ios     Safari on iOS, which has no such offer: install() can only explain
 *   null    already installed, or a browser that cannot install
 */
export type InstallOffer = 'prompt' | 'ios' | null;

function runningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function onIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Whether the app can be installed from here, and how.
 *
 * Chromium tells a page when it qualifies, by an event the page must catch
 * and keep, because the browser will only show its dialog from that event
 * and only once. iOS says nothing; a page there can only tell the player
 * where the button is. Both go quiet once the app is installed.
 */
export function useInstallPrompt(): {
  offer: InstallOffer;
  install: () => Promise<void>;
} {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(runningStandalone);

  useEffect(() => {
    const onOffer = (event: Event) => {
      // Kept for our own button, rather than letting the browser show its
      // bar wherever it likes.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onOffer);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onOffer);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    // The event is good for one dialog; whichever way it goes, it is spent.
    const offer = deferred;
    setDeferred(null);
    await offer.prompt();
    await offer.userChoice;
  }, [deferred]);

  const offer: InstallOffer = installed
    ? null
    : deferred
      ? 'prompt'
      : onIos()
        ? 'ios'
        : null;

  return { offer, install };
}
