import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstallControl } from './install-control';

/**
 * The cap is there only while the app can be installed from here, and each
 * platform has its own way of saying so. These stage each one.
 */

/** What Chromium fires when the page qualifies. */
function offerInstall(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(async () => {});
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}

function pretendIos() {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
  );
}

function pretendStandalone() {
  // jsdom has no matchMedia at all, so this defines one rather than spying.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(display-mode: standalone)',
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

describe('InstallControl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows nothing until the browser offers', () => {
    render(<InstallControl />);
    expect(screen.queryByRole('button', { name: 'install' })).toBeNull();
  });

  it('appears when the browser offers, and opens its dialog when pressed', async () => {
    const user = userEvent.setup();
    render(<InstallControl />);

    const { event, prompt } = offerInstall();

    // Kept for our own button: the browser's default bar is declined.
    expect(event.defaultPrevented).toBe(true);
    const cap = screen.getByRole('button', { name: 'install' });

    await user.click(cap);

    expect(prompt).toHaveBeenCalledTimes(1);
    // The offer is good for one dialog, so the cap goes whichever way it went.
    expect(screen.queryByRole('button', { name: 'install' })).toBeNull();
  });

  it('goes away once the app has been installed', () => {
    render(<InstallControl />);
    offerInstall();
    expect(screen.getByRole('button', { name: 'install' })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(screen.queryByRole('button', { name: 'install' })).toBeNull();
  });

  it('on iOS, explains the two taps instead of promising a dialog', async () => {
    const user = userEvent.setup();
    pretendIos();
    render(<InstallControl />);

    await user.click(screen.getByRole('button', { name: 'install' }));

    const how = screen.getByRole('dialog', { name: 'how to install' });
    expect(how).toHaveTextContent(/share/i);
    expect(how).toHaveTextContent(/add to home screen/i);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'how to install' })).toBeNull();
  });

  it('shows nothing inside the installed app', () => {
    pretendIos();
    pretendStandalone();
    render(<InstallControl />);
    offerInstall();

    expect(screen.queryByRole('button', { name: 'install' })).toBeNull();
  });
});
